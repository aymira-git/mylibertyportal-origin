const CLOUD_NAME = "w1vndykv";
const UPLOAD_PRESET = "mylibertyies-f2f38";

// Uploads a file directly from the browser to Cloudinary's free tier
// and returns the permanent HTTPS URL of the uploaded image.
export async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Upload failed");
  return data.secure_url;
}

// Same idea, but for non-image files (worksheets: PDFs, Word docs, etc).
// Cloudinary's "auto" resource type routes the file correctly whether
// it's an image, PDF, or arbitrary document — the plain /image/upload
// endpoint above rejects non-image files outright.
//
// Note: this requires the "mylibertyies-f2f38" unsigned upload preset in
// the Cloudinary dashboard to allow raw/auto uploads (Settings > Upload >
// your preset > enable "Allow unsigned uploads" for non-image formats).
// If uploads start failing with a "not allowed" error, that setting is
// the first place to check.
export async function uploadFileToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Upload failed");
  return data.secure_url;
}
