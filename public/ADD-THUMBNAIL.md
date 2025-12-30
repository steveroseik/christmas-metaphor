# Adding the Christmas Gathering Thumbnail

To use the Christmas gathering photo as the website thumbnail for WhatsApp and social media:

## Steps:

1. **Save the image file:**
   - Save the Christmas gathering image you provided
   - Name it: `christmas-gathering-thumbnail.jpg`
   - Place it in the `public/` folder

2. **Recommended image specifications:**
   - Format: JPEG or PNG
   - Dimensions: 1200x630 pixels (optimal for social media)
   - File size: Under 1MB (for faster loading)
   - If your image is a different size, you can resize it using:
     - Online tools: [resizeimage.net](https://resizeimage.net)
     - Image editing software
     - Or use the image as-is (most platforms will auto-resize)

3. **File location:**
   ```
   public/
     └── christmas-gathering-thumbnail.jpg
   ```

4. **Verify:**
   - Once the file is in place, the meta tags in `index.html` are already configured
   - The thumbnail will automatically appear when sharing the link on:
     - WhatsApp
     - Facebook
     - Twitter/X
     - LinkedIn
     - Other social media platforms

## Alternative filename:
If you prefer a different filename, update the `og:image` and `twitter:image` meta tags in `index.html` to match your filename.

## Testing:
After adding the image, you can test the thumbnail using:
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)




