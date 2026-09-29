import xss from "xss";

export const sanitizeString = (value: string): string => {
  return xss(value, {
    whiteList: {}, // No HTML allowed
    stripIgnoreTag: true,
    stripIgnoreTagBody: ["script", "style"],
  });
};

export const sanitizeObject = <T extends Record<string, unknown>>(
  obj: T,
): T => {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    const value = result[key];
    if (typeof value === "string") {
      (result as Record<string, unknown>)[key] = sanitizeString(value);
    }
  }
  return result;
};
