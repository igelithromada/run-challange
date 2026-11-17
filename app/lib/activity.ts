import type { ActivityType } from "../types";
export const ACTIVITY_TYPES: readonly ActivityType[] = ["běh", "chůze", "dřepy", "kliky"];
export const isStrengthActivity = (type: unknown) => type === "dřepy" || type === "kliky";
export const activityLabel = (type: string) => ({"běh":"Běh","chůze":"Chůze","dřepy":"Dřepy","kliky":"Kliky"})[type] || "Běh";
export const activityUnit = (type: unknown) => isStrengthActivity(type) ? "opakování" : "km";
export const activityAmount = (run: {type?:string; km?:unknown; repetitions?:unknown}) => {
 const n = Number(isStrengthActivity(run.type) ? run.repetitions : run.km);
 return Number.isFinite(n) && n > 0 ? n : 0;
};
/** Strength counts never occupy the distance field. Zero time means not recorded. */
export function validateActivityValues(type: unknown, data: {km?:unknown;minuty?:unknown;repetitions?:unknown}) {
 const strength = isStrengthActivity(type), km = strength ? 0 : Number(data.km), repetitions = strength ? Number(data.repetitions) : 0;
 const minuty = data.minuty === undefined || data.minuty === "" ? 0 : Number(data.minuty);
 if (strength ? !Number.isInteger(repetitions) || repetitions < 1 || repetitions > 100000 : !Number.isFinite(km) || km <= 0 || km > 1000) return null;
 if (!Number.isFinite(minuty) || minuty < 0 || minuty > 1440 || (!strength && minuty === 0)) return null;
 return {km,repetitions,minuty,tempo:strength ? "0" : (minuty / km).toFixed(2)};
}
