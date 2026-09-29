import { useMemo } from "react";
import BatmanAlleyBrawl from "./loadingGames/BatmanAlleyBrawl";
import GokuKamehameha from "./loadingGames/GokuKamehameha";
import GreenLanternConstructs from "./loadingGames/GreenLanternConstructs";
import IronManSkyGuard from "./loadingGames/IronManSkyGuard";
import NarutoRasengan from "./loadingGames/NarutoRasengan";
import SasukeChidori from "./loadingGames/SasukeChidori";
import { pickTheme } from "./loadingGames/shared";
import SpiderWebShooter from "./loadingGames/SpiderWebShooter";
import VegetaPride from "./loadingGames/VegetaPride";

type LoadingGameProps = {
  ready?: boolean;
  onEnter: () => void;
};

/**
 * Randomly picks one of the hero mini-games for the public portfolio loader.
 */
export default function LoadingGame({ ready = false, onEnter }: LoadingGameProps) {
  const theme = useMemo(() => pickTheme(), []);

  if (theme === "batman") return <BatmanAlleyBrawl ready={ready} onEnter={onEnter} />;
  if (theme === "ironman") return <IronManSkyGuard ready={ready} onEnter={onEnter} />;
  if (theme === "goku") return <GokuKamehameha ready={ready} onEnter={onEnter} />;
  if (theme === "naruto") return <NarutoRasengan ready={ready} onEnter={onEnter} />;
  if (theme === "sasuke") return <SasukeChidori ready={ready} onEnter={onEnter} />;
  if (theme === "vegeta") return <VegetaPride ready={ready} onEnter={onEnter} />;
  if (theme === "lantern") return <GreenLanternConstructs ready={ready} onEnter={onEnter} />;
  return <SpiderWebShooter ready={ready} onEnter={onEnter} />;
}
