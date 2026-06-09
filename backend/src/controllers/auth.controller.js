import Retailer from "../models/users/retailer.model.js";
import Distributor from "../models/users/distributor.model.js";
import Customer from "../models/users/customer.model.js";
import AepsWallet from "../models/aepsWallet.model.js";
import MainWallet from "../models/mainWallet.model.js";
import jwt from "jsonwebtoken";
import { customAlphabet } from "nanoid";
import Admin from "../models/users/admin.model.js";

export const registerAdmin = async(req,res)=>{
    try {
       const { username, email, contactNumber, password } = req.body; 
       if(!username || !email || !contactNumber || !password){
            return res.status(400).json({success: false, message: "All fields are required"});
       }
       const isAdminExist = await Admin.findOne({$or:[{email}, {username}, {contactNumber}]});
       if(isAdminExist){
            return res.status(400).json({success: false, message: "Admin already exists"});
       }
       const adminId = `ADM-${customAlphabet('0123456789', 7)}`;
       const createAdmin = await Admin.create({
           adminId,
           username,
           email,
           contactNumber,
           password,
        });
        const token = await jwt.sign({ id: createAdmin._id}, process.env.ADMIN_JWT_SECRET, {expiresIn: '1d'})
        return res.status(201).json({success: true, message: "Admin registered successfully", createAdmin, token});
    } catch (error) {
        return res.status(500).json({success: false, message: err.message});
    }
}

export const registerRetailer = async (req, res) => {
    try{
        const { username, email, contactNumber, password, panNumber, aadharNumber, gstNumber, businessName } = req.body;
        if(!username || !email || !contactNumber || !password || !panNumber || !aadharNumber || !gstNumber || !businessName){
            return res.status(400).json({success: false, message: "All fields are required"});
        }
        const isRetailerExist = await Retailer.findOne({$or:[{email}, {username}, {contactNumber}]});
        if(isRetailerExist){
            return res.status(400).json({success: false, message: "Retailer already exists"});
        }
        const distributor = await Distributor.findById(req.user.id);
        if(!distributor){
            return res.status(401).json({success: false, message: "You are not authorized to create retailer"});
        }
        const retailerId = `RTR-${customAlphabet('0123456789', 7)}`;
        const createRetailer = await Retailer.create({
            retailerId,
            username,
            email,
            contactNumber,
            password,
            kyc:{
                panNumber,
                aadharNumber,
                gstNumber,
                businessName
            }
        });

        distributor.retailers.push(createRetailer._id);
        await distributor.save();

        const token = await jwt.sign({ id: createRetailer._id}, process.env.RETAILER_JWT_SECRET, {expiresIn: '1d'})
        return res.status(201).json({success: true, message: "Retailer registered successfully", createRetailer, token});
    }
    catch(err){
        return res.status(500).json({success: false, message: err.message});
    }
}

export const registerDistributor = async (req, res) => {
    try{
        const { username, email, contactNumber, password, panNumber, aadharNumber, gstNumber, businessName } = req.body;
        if(!username || !email || !contactNumber || !password || !panNumber || !aadharNumber || !gstNumber || !businessName){
            return res.status(400).json({success: false, message: "All fields are required"});
        }
        const isDistributorExist = await Distributor.findOne({$or:[{email}, {username}, {contactNumber}]});
        if(isDistributorExist){
            return res.status(400).json({success: false, message: "Distributor already exists"});
        }
        const admin = await Admin.findById(req.user.id);
        if(!admin){
            return res.status(401).json({success: false, message: "You are not authorized to create distributor"});
        }

        const distributorId = `DTR-${customAlphabet('0123456789', 7)}`;
        const createDistributor = await Distributor.create({
            distributorId,
            username,
            email,
            contactNumber,
            password,
            kyc:{
                panNumber,
                aadharNumber,
                gstNumber,
                businessName
            }
        });

        admin.distributors.push(createDistributor._id);
        await admin.save();

        const token = await jwt.sign({ id: createDistributor._id}, process.env.DISTRIBUTOR_JWT_SECRET, {expiresIn: '1d'})
        return res.status(201).json({success: true, message: "Distributor registered successfully", createDistributor, token});
    }
    catch(err){
        return res.status(500).json({success: false, message: err.message});
    }
}

export const registerCustomer = async (req, res) => {
    try{
        const { username, email, contactNumber, password } = req.body;
        if(!username || !email || !contactNumber || !password){
            return res.status(400).json({success: false, message: "All fields are required"});
        }
        const isCustomerExist = await Customer.findOne({$or:[{email}, {username}, {contactNumber}]});
        if(isCustomerExist){
            return res.status(400).json({success: false, message: "Customer already exists"});
        }

        const retailer = await Retailer.findById(req.user.id);
        if(!retailer){
            return res.status(401).json({success: false, message: "You are not authorized to create customer"});
        }

        const customerId = `CST-${customAlphabet('0123456789', 7)}`;
        const createCustomer = await Customer.create({
            customerId,
            username,
            email,
            contactNumber,
            password
        });

        retailer.customers.push(createCustomer._id);
        await retailer.save();

        const token = await jwt.sign({ id: createCustomer._id}, process.env.CUSTOMER_JWT_SECRET || process.env.JWT_SECRET, {expiresIn: '1d'});
        return res.status(201).json({success: true, message: "Customer registered successfully", createCustomer, token});
    }
    catch(err){
        return res.status(500).json({success: false, message: err.message});
    }
}

export const getAllCustomer = async(req,res)=>{
    try {
        const retailer = await Retailer.findById(req.user.id);
        if(!retailer){
            return res.status(401).json({success: false, message: "You are not authorized to get customer"});
        }
        const customers = await Customer.find({retailer: retailer._id});
        return res.status(200).json({success: true, message: "Customers fetched successfully", customers});
    } catch (error) {
        return res.status(500).json({success: false, message: error.message});
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