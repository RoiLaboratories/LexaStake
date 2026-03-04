import { NextRequest, NextResponse } from "next/server";
import { supabaseServiceClient } from "@/services/supabase.service";

/**
 * Server-side endpoint to upload profile images
 * Uses service role to bypass RLS policies
 * POST /api/upload-profile-image
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const userAddress = formData.get("userAddress") as string;

    if (!file || !userAddress) {
      return NextResponse.json(
        { error: "Missing file or userAddress" },
        { status: 400 }
      );
    }

    if (!supabaseServiceClient) {
      return NextResponse.json(
        { error: "Supabase service client not configured" },
        { status: 500 }
      );
    }

    // Convert file to buffer
    const buffer = await file.arrayBuffer();

    // Create unique filename
    const timestamp = Date.now();
    const fileExt = file.name.split(".").pop();
    const fileName = `${userAddress.toLowerCase()}-${timestamp}.${fileExt}`;

    console.log(`📤 Uploading profile image: ${fileName}`);

    // Upload to storage
    const { data, error } = await supabaseServiceClient.storage
      .from("profile-images")
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      console.error("❌ Storage upload error:", error);
      return NextResponse.json(
        { error: `Upload failed: ${error.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabaseServiceClient.storage
      .from("profile-images")
      .getPublicUrl(fileName);

    const imageUrl = publicUrlData.publicUrl;

    // Save URL to profiles table
    const { error: dbError } = await supabaseServiceClient
      .from("profiles")
      .upsert(
        {
          user_address: userAddress.toLowerCase(),
          profile_image_url: imageUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_address" }
      );

    if (dbError) {
      console.warn("⚠️ Could not save profile image URL:", dbError);
      // Don't fail the upload if DB save fails - image is already in storage
    }

    console.log(`✅ Profile image uploaded: ${imageUrl}`);

    return NextResponse.json({
      success: true,
      url: imageUrl,
    });
  } catch (error) {
    console.error("❌ Error in upload endpoint:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
