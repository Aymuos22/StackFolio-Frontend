import { useMemo } from "react";
import type { PortfolioTheme } from "../types/portfolio";
import BatmanAlleyBrawl from "./loadingGames/BatmanAlleyBrawl";
import FullmetalAlchemy from "./loadingGames/FullmetalAlchemy";
import GojoVsSukuna from "./loadingGames/GojoVsSukuna";
import GokuKamehameha from "./loadingGames/GokuKamehameha";
import GreenLanternConstructs from "./loadingGames/GreenLanternConstructs";
import IronManSkyGuard from "./loadingGames/IronManSkyGuard";
import NarutoRasengan from "./loadingGames/NarutoRasengan";
import ObitoKamui from "./loadingGames/ObitoKamui";
import SasukeChidori from "./loadingGames/SasukeChidori";
import { LoadingGamePortfolioThemeProvider, pickTheme } from "./loadingGames/shared";
import SpiderWebShooter from "./loadingGames/SpiderWebShooter";
import SupermanHeatFreeze from "./loadingGames/SupermanHeatFreeze";
import VegetaPride from "./loadingGames/VegetaPride";
import WolverineClaws from "./loadingGames/WolverineClaws";

type LoadingGameProps = {
  ready?: boolean;
  onEnter: () => void;
  /**
   * Public portfolio theme for shell chrome.
   * `null` = theme not known yet (neutral pending shell — never assume comic).
   */
  portfolioTheme?: PortfolioTheme | null;
};

/**
 * Randomly picks one of the hero mini-games for the public portfolio loader.
 */
export default function LoadingGame({
  ready = false,
  onEnter,
  portfolioTheme = null,
}: LoadingGameProps) {
  const theme = useMemo(() => pickTheme(), []);

  const game =
    theme === "batman" ? (
      <BatmanAlleyBrawl ready={ready} onEnter={onEnter} />
    ) : theme === "ironman" ? (
      <IronManSkyGuard ready={ready} onEnter={onEnter} />
    ) : theme === "goku" ? (
      <GokuKamehameha ready={ready} onEnter={onEnter} />
    ) : theme === "naruto" ? (
      <NarutoRasengan ready={ready} onEnter={onEnter} />
    ) : theme === "sasuke" ? (
      <SasukeChidori ready={ready} onEnter={onEnter} />
    ) : theme === "obito" ? (
      <ObitoKamui ready={ready} onEnter={onEnter} />
    ) : theme === "vegeta" ? (
      <VegetaPride ready={ready} onEnter={onEnter} />
    ) : theme === "lantern" ? (
      <GreenLanternConstructs ready={ready} onEnter={onEnter} />
    ) : theme === "superman" ? (
      <SupermanHeatFreeze ready={ready} onEnter={onEnter} />
    ) : theme === "wolverine" ? (
      <WolverineClaws ready={ready} onEnter={onEnter} />
    ) : theme === "fma" ? (
      <FullmetalAlchemy ready={ready} onEnter={onEnter} />
    ) : theme === "jjk" ? (
      <GojoVsSukuna ready={ready} onEnter={onEnter} />
    ) : (
      <SpiderWebShooter ready={ready} onEnter={onEnter} />
    );

  return <LoadingGamePortfolioThemeProvider theme={portfolioTheme}>{game}</LoadingGamePortfolioThemeProvider>;
}
