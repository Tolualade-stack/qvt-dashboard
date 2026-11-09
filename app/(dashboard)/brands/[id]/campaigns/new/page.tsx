import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { loadWorld } from "@/lib/world";
import { mediaUrl } from "@/lib/media";
import { loadWizardPeople } from "@/lib/campaign-wizard-data";
import { CampaignWizardLoader } from "../campaign-wizard-loader";

export const metadata: Metadata = { title: "New campaign · PRIME" };

export default async function NewCampaignPage({ params }: PageProps<"/brands/[id]/campaigns/new">) {
  const { id } = await params;
  const me = await requireAdmin();
  const { brand, theme, supabase } = await loadWorld(id);

  // Work this world already tracks that isn't in a campaign yet.
  const counted = { count: "exact", head: true } as const;
  const [people, { count: content }, { count: ads }, { count: assets }, { count: reports }] = await Promise.all([
    loadWizardPeople(supabase),
    supabase.from("content_items").select("id", counted).eq("brand_id", id).is("campaign_id", null).eq("is_archived", false).neq("status", "posted"),
    supabase.from("ads").select("id", counted).eq("brand_id", id).is("campaign_id", null).eq("is_archived", false).neq("status", "ended"),
    supabase.from("creative_assets").select("id", counted).eq("brand_id", id).is("campaign_id", null).eq("is_archived", false).neq("status", "deployed"),
    supabase.from("reports").select("id", counted).eq("brand_id", id).is("campaign_id", null).is("sent_at", null),
  ]);

  return (
    <CampaignWizardLoader
      brandId={id}
      brandName={brand.name}
      theme={theme}
      banner={mediaUrl(brand.banner_path)}
      logo={mediaUrl(brand.logo_path)}
      people={people}
      myPersonId={me.personId}
      defaults={{
        reporting: brand.reporting,
        tier: brand.tier,
        leaveCoverId: brand.leave_cover_person_id,
        contentMin: brand.monthly_content_target_min,
        contentMax: brand.monthly_content_target_max,
        assets: brand.creative_assets_target,
      }}
      existing={{ content: content ?? 0, ads: ads ?? 0, assets: assets ?? 0, reports: reports ?? 0 }}
    />
  );
}
