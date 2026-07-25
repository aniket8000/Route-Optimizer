import mongoose from "mongoose";

const stopSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    label: { type: String }, // optional, e.g. address or "Stop 1"
  },
  { _id: false }
);

const legSchema = new mongoose.Schema(
  { from: Number, to: Number, duration: Number, distance: Number },
  { _id: false }
);

const routeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    driverName: { type: String, default: "Unnamed driver" },
    stops: { type: [stopSchema], required: true },
    order: { type: [Number], required: true }, // solved visit order, indexes into stops
    legs: { type: [legSchema], required: true }, // leg-by-leg breakdown, so history can show it too
    totalDuration: { type: Number, required: true }, // seconds
    totalDistance: { type: Number, required: true }, // meters
  },
  { timestamps: true }
);

export default mongoose.model("Route", routeSchema);
