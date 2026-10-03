/** Money is stored as integer paise everywhere. */
export const toPaise = (rupees: number): number => Math.round(rupees * 100);

const rupeeFormat = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export const formatINR = (paise: number): string => rupeeFormat.format(paise / 100);
