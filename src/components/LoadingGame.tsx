import { useMemo } from "react";
import BatmanAlleyBrawl from "./loadingGames/BatmanAlleyBrawl";
import IronManSkyGuard from "./loadingGames/IronManSkyGuard";
import { pickTheme } from "./loadingGames/shared";
import SpiderWebShooter from "./loadingGames/SpiderWebShooter";

type LoadingGameProps = {
  ready?: boolean;
  onEnter: () => void;
};

/**
 * Randomly picks one of three distinct hero mini-games for the public portfolio loader.
 */
export default function LoadingGame({ ready = false, onEnter }: LoadingGameProps) {
  const theme = useMemo(() => pickTheme(), []);

  if (theme === "batman") return <BatmanAlleyBrawl ready={ready} onEnter={onEnter} />;
  if (theme === "ironman") return <IronManSkyGuard ready={ready} onEnter={onEnter} />;
  return <SpiderWebShooter ready={ready} onEnter={onEnter} />;
}
