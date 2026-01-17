import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb", // keep small upload limit
    },
  },
};

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Allowed extensions list
const ALLOWED_EXTENSIONS = [
  "jpg",
  "jpeg",
  "heic",
  "png",
  "pdf",
  "doc",
  "docx",
];

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { fileName, file } = req.body;

    if (!fileName || !file) {
      return res.status(400).json({ error: "Missing fileName or file" });
    }

    // Prevent path hacking
    if (!fileName.startsWith("uploads/")) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    // Validate extension
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({ error: "File type not allowed" });
    }

    // Decode base64
    const buffer = Buffer.from(file, "base64");

    // Upload
    const { error } = await supabase.storage
      .from("uploads")
      .upload(fileName, buffer, {
        upsert: false,
      });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const { data } = supabase.storage.from("uploads").getPublicUrl(fileName);

    return res.status(200).json({ url: data.publicUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
