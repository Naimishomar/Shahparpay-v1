import jwt from "jsonwebtoken";
import Admin from "../models/users/admin.model.js";
import Distributor from "../models/users/distributor.model.js";
import Retailer from "../models/users/retailer.model.js";

export const authMiddlewares = async(req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = req.cookies?.token || (authHeader ? authHeader.split(" ")[1] : null);
        
        if (!token) {
            return res.status(401).json({ success: false, message: "Unauthorized request" });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET || "default_secret");

        let user;
        if (decodedToken.role === 'admin') {
            user = await Admin.findById(decodedToken.id).select("-password");
        } else if (decodedToken.role === 'distributor') {
            user = await Distributor.findById(decodedToken.id).select("-password");
        } else if (decodedToken.role === 'retailer') {
            user = await Retailer.findById(decodedToken.id).select("-password");
        }

        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid Access Token" });
        }

        req.user = user;
        req.user.role = decodedToken.role; // Attach role for route guarding
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: error?.message || "Invalid access token" });
    }
};