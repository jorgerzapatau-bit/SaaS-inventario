import { redirect } from 'next/navigation';

export default async function Home(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const searchParams = await props.searchParams;
  if (searchParams?.company) {
    redirect(`/login?company=${searchParams.company}`);
  } else {
    redirect('/login');
  }
}
