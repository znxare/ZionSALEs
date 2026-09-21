import { useCountUp } from '@/lib/hooks';

/** Drop-in replacement for rendering a plain number — counts up to the value on change instead of jumping. */
export default function AnimatedNumber({ value }: { value: number }) {
  const display = useCountUp(value);
  return <>{display}</>;
}
