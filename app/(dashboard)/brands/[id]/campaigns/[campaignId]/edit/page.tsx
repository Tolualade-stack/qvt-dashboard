import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { loadWorld } from "@/lib/world";
import { mediaUrl } from "@/lib/media";
import { loadWizardPeople } from "@/lib/campaign-wizard-data";
import { CampaignWizard } from "../../campaign-wizard";

export const metadata: Metadata = { title: "Edit campaign · PRIME" };

export default async function EditCampaignPage({ params }: PageProps<"/brands/[id]/campaigns/[campaignId]/edit">) {
  const { id, campaignId } = await params;
  const me = await requireAdmin();
  const { brand, theme, supabase } = await loadWorld(id);

  const [{ data: campaign }, { data: team }, { data: areas }, people] = await Promise.all([
    supabase.from("campaigns").select("*").eq("id", campaignId).eq("brand_id", id).maybeSingle(),
    supabase.from("campaign_team").select("person_id").eq("campaign_id", campaignId),
    supabase.from("campaign_areas").select("area, person_id").eq("campaign_id", campaignId),
    loadWizardPeople(supabase),
  ]);
  if (!campaign) notFound();

  return (
    <CampaignWizard
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
      existing={{ content: 0, ads: 0, assets: 0, reports: 0 }}
      editing={{
        id: campaignId,
        fields: {
          ...campaign,
          brand_id: id,
          team: (team ?? []).map((t) => t.person_id as string),
          areas: (areas ?? []) as { area: string; person_id: string }[],
        },
      }}
    />
  );
}
