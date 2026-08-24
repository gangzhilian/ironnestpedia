import { getSearchDocuments, localeCodes, type Locale } from '../../lib/data';

export function getStaticPaths() {
  return localeCodes.map((locale) => ({ params: { locale }, props: { locale } }));
}

export function GET({ props }: { props: { locale: Locale } }) {
  return new Response(JSON.stringify(getSearchDocuments(props.locale)), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
