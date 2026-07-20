//! 共有IDの生成。推測困難な base62 12文字。

const ALPHABET: &[u8; 62] =
    b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ID_LEN: usize = 12;

/// ランダムな base62 12文字の共有IDを生成する。
pub fn generate_share_id() -> String {
    let mut bytes = [0u8; ID_LEN];
    getrandom::getrandom(&mut bytes).expect("rng should be available");
    id_from_bytes(&bytes)
}

/// 乱数バイト列を base62 文字列に変換する（テスト用に純粋関数として分離）。
fn id_from_bytes(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|b| ALPHABET[(*b as usize) % ALPHABET.len()] as char)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_ids_of_expected_length() {
        assert_eq!(generate_share_id().len(), ID_LEN);
    }

    #[test]
    fn only_uses_base62_alphabet() {
        let id = generate_share_id();
        assert!(id.bytes().all(|c| ALPHABET.contains(&c)));
    }

    #[test]
    fn id_from_bytes_is_deterministic() {
        let bytes = [0u8, 1, 61, 62, 123, 255, 10, 20, 30, 40, 50, 60];
        assert_eq!(id_from_bytes(&bytes), id_from_bytes(&bytes));
        assert_eq!(id_from_bytes(&bytes).len(), bytes.len());
    }

    #[test]
    fn id_from_bytes_maps_into_alphabet() {
        let bytes = [255u8; ID_LEN];
        let id = id_from_bytes(&bytes);
        assert!(id.bytes().all(|c| ALPHABET.contains(&c)));
    }
}
