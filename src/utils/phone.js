export const phoneDigits = (value) => {
  const raw=String(value||"").replace(/\D/g,"");
  const local=raw.startsWith("998")?raw.slice(3):raw;
  return local.slice(0,9);
};

export const formatUzPhone = (value) => {
  const digits=phoneDigits(value);
  const parts=[digits.slice(0,2),digits.slice(2,5),digits.slice(5,7),digits.slice(7,9)].filter(Boolean);
  return `+998${parts.length?` ${parts.join(" ")}`:" "}`;
};

export const normalizedUzPhone = (value) => {
  const digits=phoneDigits(value);
  return digits.length===9?`998${digits}`:"";
};

export const isValidUzPhone = (value) => normalizedUzPhone(value).length===12;
export const sameUzPhone = (a,b) => {
  const left=normalizedUzPhone(a),right=normalizedUzPhone(b);
  return Boolean(left&&right&&left===right);
};
