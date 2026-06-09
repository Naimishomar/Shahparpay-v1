import Retailer from "../models/users/retailer.model.js";
import Distributor from "../models/users/distributor.model.js";
import Customer from "../models/users/customer.model.js";
import AepsWallet from "../models/aepsWallet.model.js";
import MainWallet from "../models/mainWallet.model.js";
import jwt from "jsonwebtoken";

export const registerAdmin = async(req,res)=>{
    try {
       const { } = req.body; 
    } catch (error) {
        return res.status(500).json({success: false, message: err.message});
    }
}

export const registerRetailer = async (req, res) => {
    try{
        const { } = req.body;
    }
    catch(err){
        return res.status(500).json({success: false, message: err.message});
    }
}

export const registerDistributor = async (req, res) => {
    try{
        const { } = req.body;
    }
    catch(err){
        return res.status(500).json({success: false, message: err.message});
    }
}

export const registerCustomer = async (req, res) => {
    try{
        const { } = req.body;
    }
    catch(err){
        return res.status(500).json({success: false, message: err.message});
    }
}

export const addBankAccount = async(req,res)=>{
    try {
        
    } catch (error) {
        return res.status(500).json({success: false, message: err.message});
    }
}

export const createAepsWallet = async(req,res)=>{
    try {
        
    } catch (error) {
        return res.status(500).json({success: false, message: err.message});
    }
}


export const createMainWallet = async(req,res)=>{
    try {
        
    } catch (error) {
        return res.status(500).json({success: false, message: err.message});
    }
}