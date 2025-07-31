# Setting Up Google Gemini AI API

To enable real speech-to-text transcription with Google Gemini AI, follow these steps:

## 1. Get Your Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click "Get API Key" in the top navigation
4. Create a new API key or use an existing one
5. Copy your API key

## 2. Configure Your Environment

1. Open the `.env` file in the `backend` directory
2. Replace `your_gemini_api_key_here` with your actual API key:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

## 3. Install Speech-to-Text Package (Optional Enhancement)

For more advanced speech-to-text capabilities, you can also integrate Google Speech-to-Text API:

```bash
pip install google-cloud-speech
```

## 4. Test the Configuration

1. Restart your backend server
2. Record a new pitch in the frontend
3. Check that the transcription is more detailed than the mock version

## Notes

- The current implementation uses Gemini's text generation capabilities
- For production, consider implementing Google Speech-to-Text API for better audio transcription
- Make sure to keep your API key secure and never commit it to version control
- Monitor your API usage in Google AI Studio to avoid unexpected charges

## Troubleshooting

If you encounter issues:
1. Verify your API key is correct
2. Check your internet connection
3. Ensure you have sufficient API quota
4. Check the backend logs for detailed error messages
