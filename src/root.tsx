import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';
import './index.css';
import { BattlesProvider } from './context/BattlesContext';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/svg+xml" href={`${import.meta.env.BASE_URL}favicon.svg`} />
        <title>duel-tools</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return (
    <BattlesProvider>
      <Outlet />
    </BattlesProvider>
  );
}
