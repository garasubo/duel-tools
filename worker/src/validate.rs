//! 共有スナップショットのサーバ側検証。クライアントを信頼せず構造を確認する。
//! `serde_json::Value` で緩く検証し、必須フィールドと enum 値だけを保証する。

use serde_json::Value;

const MAX_RECORDS: usize = 5000;
const MAX_TITLE_CHARS: usize = 80;

/// リクエストボディ(JSON文字列)を検証する。問題があれば `Err(理由)`。
pub fn validate_snapshot(body: &str) -> Result<(), String> {
    let value: Value = serde_json::from_str(body).map_err(|_| "invalid json".to_string())?;
    let obj = value.as_object().ok_or("payload must be an object")?;

    match obj.get("version").and_then(Value::as_i64) {
        Some(1) => {}
        _ => return Err("unsupported version".into()),
    }

    // title は任意。あれば文字列かつ長さ制限内であること。
    if let Some(title) = obj.get("title") {
        if !title.is_null() {
            let text = title.as_str().ok_or("title must be a string")?;
            if text.chars().count() > MAX_TITLE_CHARS {
                return Err("title is too long".into());
            }
        }
    }

    let records = obj
        .get("records")
        .and_then(Value::as_array)
        .ok_or("records must be an array")?;
    if records.len() > MAX_RECORDS {
        return Err("too many records".into());
    }
    for record in records {
        validate_record(record)?;
    }

    validate_decks(obj.get("ownDecks"), "ownDecks")?;
    validate_decks(obj.get("opponentDecks"), "opponentDecks")?;

    let tags = obj
        .get("knownTags")
        .and_then(Value::as_array)
        .ok_or("knownTags must be an array")?;
    if !tags.iter().all(Value::is_string) {
        return Err("knownTags must be strings".into());
    }

    Ok(())
}

fn validate_record(record: &Value) -> Result<(), String> {
    let obj = record.as_object().ok_or("record must be an object")?;

    for key in ["id", "createdAt", "ownDeckId", "opponentDeckId", "memo"] {
        if !obj.get(key).map(Value::is_string).unwrap_or(false) {
            return Err(format!("record.{key} must be a string"));
        }
    }

    match obj.get("result").and_then(Value::as_str) {
        Some("win") | Some("loss") => {}
        _ => return Err("record.result must be win or loss".into()),
    }
    match obj.get("turnOrder").and_then(Value::as_str) {
        Some("first") | Some("second") | Some("third") => {}
        _ => return Err("record.turnOrder is invalid".into()),
    }

    let tags = obj
        .get("reasonTags")
        .and_then(Value::as_array)
        .ok_or("record.reasonTags must be an array")?;
    if !tags.iter().all(Value::is_string) {
        return Err("record.reasonTags must be strings".into());
    }

    Ok(())
}

fn validate_decks(value: Option<&Value>, field: &str) -> Result<(), String> {
    let arr = value
        .and_then(Value::as_array)
        .ok_or_else(|| format!("{field} must be an array"))?;
    for deck in arr {
        let obj = deck
            .as_object()
            .ok_or_else(|| format!("{field} entry must be an object"))?;
        if !obj.get("id").map(Value::is_string).unwrap_or(false)
            || !obj.get("name").map(Value::is_string).unwrap_or(false)
        {
            return Err(format!("{field} entry needs string id and name"));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_body() -> String {
        r#"{
            "version": 1,
            "createdAt": "2026-07-01T10:00:00.000Z",
            "records": [
                {
                    "id": "r1",
                    "createdAt": "2026-07-01T10:00:00.000Z",
                    "ownDeckId": "own-1",
                    "opponentDeckId": "",
                    "result": "win",
                    "turnOrder": "first",
                    "reasonTags": ["先攻有利"],
                    "memo": "メモ"
                }
            ],
            "ownDecks": [{"id": "own-1", "name": "自デッキ"}],
            "opponentDecks": [],
            "knownTags": ["先攻有利"]
        }"#
        .to_string()
    }

    #[test]
    fn accepts_valid_payload() {
        assert!(validate_snapshot(&valid_body()).is_ok());
    }

    #[test]
    fn rejects_invalid_json() {
        assert!(validate_snapshot("not json").is_err());
    }

    #[test]
    fn rejects_wrong_version() {
        let body = valid_body().replace("\"version\": 1", "\"version\": 2");
        assert!(validate_snapshot(&body).is_err());
    }

    #[test]
    fn rejects_bad_result() {
        let body = valid_body().replace("\"result\": \"win\"", "\"result\": \"draw\"");
        assert!(validate_snapshot(&body).is_err());
    }

    #[test]
    fn rejects_bad_turn_order() {
        let body = valid_body().replace("\"turnOrder\": \"first\"", "\"turnOrder\": \"zeroth\"");
        assert!(validate_snapshot(&body).is_err());
    }

    #[test]
    fn rejects_missing_records_array() {
        let body = r#"{"version": 1, "ownDecks": [], "opponentDecks": [], "knownTags": []}"#;
        assert!(validate_snapshot(body).is_err());
    }

    #[test]
    fn rejects_deck_without_name() {
        let body = valid_body().replace(
            "{\"id\": \"own-1\", \"name\": \"自デッキ\"}",
            "{\"id\": \"own-1\"}",
        );
        assert!(validate_snapshot(&body).is_err());
    }

    #[test]
    fn rejects_non_string_tag() {
        let body = valid_body().replace("\"knownTags\": [\"先攻有利\"]", "\"knownTags\": [1]");
        assert!(validate_snapshot(&body).is_err());
    }

    #[test]
    fn accepts_string_title() {
        let body = valid_body().replace(
            "\"version\": 1,",
            "\"version\": 1, \"title\": \"7月ランク戦\",",
        );
        assert!(validate_snapshot(&body).is_ok());
    }

    #[test]
    fn rejects_non_string_title() {
        let body = valid_body().replace("\"version\": 1,", "\"version\": 1, \"title\": 123,");
        assert!(validate_snapshot(&body).is_err());
    }

    #[test]
    fn rejects_too_long_title() {
        let long = "あ".repeat(81);
        let body = valid_body().replace(
            "\"version\": 1,",
            &format!("\"version\": 1, \"title\": \"{long}\","),
        );
        assert!(validate_snapshot(&body).is_err());
    }
}
