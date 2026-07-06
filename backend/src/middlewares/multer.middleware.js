import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure temp directory exists
const tempDir = path.join(process.cwd(), "public", "temp");
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, tempDir)
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname + "-" + Date.now())
    }
  })
  
export const upload = multer({ 
    storage, 
})
