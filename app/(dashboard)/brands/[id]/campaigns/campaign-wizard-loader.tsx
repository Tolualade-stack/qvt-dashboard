"use client";

import dynamic from "next/dynamic";

// Campaign setup runs only in the browser, so it can pick up a half-finished
// setup saved on this device.
export const CampaignWizardLoader = dynamic(() => import("./campaign-wizard").then((m) => m.CampaignWizard), {
  ssr: false,
  loading: () => (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse space-y-4">
      <div className="-mx-5 -mt-4 h-[168px] bg-mist sm:mx-0 sm:mt-0 sm:rounded-[26px]" />
      <div className="h-12 rounded-2xl bg-mist" />
      <div className="h-32 rounded-2xl bg-mist" />
    </div>
  ),
});
