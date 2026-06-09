import express from "express";
import jwt from "jsonwebtoken";

export const authMiddlewares = async(req,res,next)=>{
    try {
        const token = req.cookies.token || req.headers.authorization.split(" ")[1];
        if(!token){
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const decodedId = jwt.verify(token, process.env.JWT_SECRET);
        if(!decodedId){
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        req.user = decodedId;
        next();
    } catch (error) {
        return res.status(500).json({ message: "Failed to authenticate user", error: error.message })
    }
}