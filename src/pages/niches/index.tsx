import { useParams } from "react-router-dom";
import NicheLandingPage from "./NicheLandingPage";
import { nicheConfigs } from "./configs";
import NotFound from "@/pages/NotFound";

export default function NichePage() {
  const { niche } = useParams<{ niche: string }>();
  
  if (!niche || !nicheConfigs[niche]) {
    return <NotFound />;
  }

  return <NicheLandingPage config={nicheConfigs[niche]} />;
}
