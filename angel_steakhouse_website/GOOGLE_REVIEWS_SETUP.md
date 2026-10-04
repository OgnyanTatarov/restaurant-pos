# How to Set Up Google Reviews API

This guide will help you fetch real 5-star reviews from Google Business and display them on your website.

## Prerequisites

- A Google account
- Access to Google Cloud Console
- Your Google Business listing URL

## Step 1: Get Your Google Place ID

1. Go to [Google Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id)
2. Search for "Angel Steakhouse" or enter your business address
3. Click on your business in the results
4. Copy the **Place ID** (it looks like: `ChIJ...`)

Alternatively, you can extract it from your Google Maps URL:
- Your Place ID is in the embed URL: `!2sAngel%20Steakhouse`
- Or use the [Place ID Finder tool](https://developers.google.com/maps/documentation/places/web-service/place-id)

## Step 2: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click **"New Project"**
4. Enter a project name (e.g., "Angel Steakhouse Website")
5. Click **"Create"**
6. Select your new project from the dropdown

## Step 3: Enable Places API

1. In Google Cloud Console, go to **"APIs & Services"** > **"Library"**
2. Search for **"Places API"**
3. Click on **"Places API"**
4. Click **"Enable"**

## Step 4: Create an API Key

1. Go to **"APIs & Services"** > **"Credentials"**
2. Click **"Create Credentials"** > **"API Key"**
3. Your API key will be generated
4. **Important:** Click **"Restrict Key"** to secure it:
   - Under **"API restrictions"**, select **"Restrict key"**
   - Choose **"Places API"** from the list
   - Click **"Save"**
5. Copy your API key (you'll need it in the next step)

## Step 5: Add API Key to Your Project

1. In your project root directory, create a file named `.env.local` (if it doesn't exist)
2. Add the following line:
   ```
   NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=your_api_key_here
   ```
3. Replace `your_api_key_here` with your actual API key
4. **Important:** Make sure `.env.local` is in your `.gitignore` file to keep your API key secure

## Step 6: Update the Reviews Component

1. Open `app/components/Reviews.tsx`
2. Find the line: `const PLACE_ID = 'ChIJ...';`
3. Replace `'ChIJ...'` with your actual Place ID from Step 1

Example:
```typescript
const PLACE_ID = 'ChIJN1t_tDeuEmsRUsoyG83frY4'; // Your actual Place ID
```

## Step 7: Restart Your Development Server

After adding the environment variable, restart your Next.js development server:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## Step 8: Test the Integration

1. Visit your website
2. Navigate to the Reviews section
3. You should see real 5-star reviews from Google Business

## Troubleshooting

### Reviews not showing?

1. **Check your API key:**
   - Make sure it's correctly set in `.env.local`
   - Verify the API key is enabled for Places API
   - Check that the API key isn't restricted incorrectly

2. **Check your Place ID:**
   - Verify the Place ID is correct
   - Make sure it matches your Google Business listing

3. **Check browser console:**
   - Open browser DevTools (F12)
   - Look for any error messages
   - Check the Network tab for API call failures

4. **API Quotas:**
   - Google Places API has free tier limits
   - Check your usage in Google Cloud Console
   - You may need to enable billing for higher limits

### Common Errors

**"This API project is not authorized to use this API"**
- Make sure Places API is enabled in your Google Cloud project

**"REQUEST_DENIED"**
- Your API key might be restricted incorrectly
- Check API restrictions in Google Cloud Console

**"INVALID_REQUEST"**
- Your Place ID might be incorrect
- Double-check the Place ID format

## API Costs

- Google Places API offers a **$200 free credit per month**
- After that, it's approximately **$0.017 per request**
- For a typical website, this should be well within the free tier

## Security Best Practices

1. **Never commit `.env.local` to Git**
2. **Restrict your API key** to only the Places API
3. **Add domain restrictions** in Google Cloud Console (optional but recommended)
4. **Monitor your API usage** regularly

## Alternative: Manual Reviews

If you prefer not to use the API, you can manually update the reviews in `Reviews.tsx`:

1. Open `app/components/Reviews.tsx`
2. Find the `getSampleReviews()` function
3. Replace the sample reviews with your actual reviews
4. The component will use these instead of fetching from Google

## Need Help?

- [Google Places API Documentation](https://developers.google.com/maps/documentation/places/web-service)
- [Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id)
- [Google Cloud Console](https://console.cloud.google.com/)

