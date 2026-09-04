import type { Metadata } from 'next';
import LandingClient from './landing-client';

export const metadata: Metadata = {
  title: 'Snck AI — Multi-Provider AI Chat Platform',
};

export default function HomePage() {
  return <LandingClient />;
}
