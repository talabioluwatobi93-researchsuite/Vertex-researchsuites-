import type { Feature } from "./types";
import { proposals } from "./proposals";
import { pilot } from "./pilot";
import { cleaning } from "./cleaning";
import { quant } from "./quant";
import { qual } from "./qual";
import { voice } from "./voice";
import { restyle } from "./restyle";

export type { Feature } from "./types";
export const FEATURES: Feature[] = [proposals, pilot, cleaning, quant, qual, voice, restyle];
