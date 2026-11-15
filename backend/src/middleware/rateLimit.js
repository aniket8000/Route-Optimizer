import { rateLimit, ipKeyGenerator } from "express-rate-limit";

// on render every request comes through cloudflare, which sets cf-connecting-ip to the
// real visitor ip (and overwrites anything the client tries to send in it). locally
// there's no cloudflare, so just fall back to the socket ip
function clientKey(req) {
  return ipKeyGenerator(req.headers["cf-connecting-ip"] || req.ip);
}

const shared = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: clientKey,
  // we key off cf-connecting-ip ourselves, so the x-forwarded-for / trust proxy check doesn't apply
  validate: { xForwardedForHeader: false },
};

// every optimize call hits the public OSRM server and the solver - stop one person
// from hammering them (and getting us blocked) while leaving plenty for normal use
export const optimizeLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 1000,
  limit: 20,
  message: { error: "too many optimize requests, please wait a minute and try again" },
});

// only failed attempts count, so a real user logging in normally never hits this -
// it's here to slow down someone guessing passwords
export const authLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  message: { error: "too many attempts, please try again in a few minutes" },
});
