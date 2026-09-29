import { useMemo } from "react";
import BatmanAlleyBrawl from "./loadingGames/BatmanAlleyBrawl";
import GokuKamehameha from "./loadingGames/GokuKamehameha";
import IronManSkyGuard from "./loadingGames/IronManSkyGuard";
import { pickTheme } from "./loadingGames/shared";
import SpiderWebShooter from "./loadingGames/SpiderWebShooter";

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
  return <SpiderWebShooter ready={ready} onEnter={onEnter} />;
}
