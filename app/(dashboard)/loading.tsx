// Shown the instant a screen is tapped, while its data loads, so taps never
// feel stuck. The header and menu bar stay in place around it.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse space-y-4">
      <div className="h-36 rounded-[30px] bg-mist" />
      <div className="h-24 rounded-3xl bg-mist" />
      <div className="h-24 rounded-3xl bg-mist" />
    </div>
  );
}
