# Synapic Search: Your Privacy-Focused Local Search Engine

Synapic Search is a Deno-based search engine application that prioritizes user privacy while delivering a fast and effective search experience. Unlike traditional search engines, Synapic Search does not collect any personal data or send it to external servers. All your search history and preferences are stored locally on your device, remaining entirely under your control.

## Features
- Privacy-Focused: No personal information is collected, tracked, or shared with third parties.
- Local Data Storage: All data, including search history and language preferences, is stored locally on your device.
- Multiple Search Types: Capability to perform Web, Image, Video, News, and Wikipedia searches.
- Fast and Modern Interface: Responsive and user-friendly design built with Tailwind CSS.
- Deno-Based: Provides a secure and fast runtime environment.
- Customizable Language Settings: You can set your search language according to preference and save this setting locally.
- Search History Management: Access and clear your locally stored search history anytime.

## Requirements
- Deno must be installed on your system to run Synapic Search. Deno is a secure runtime for JavaScript, TypeScript, and WebAssembly. To install Deno, use the following commands: <br />

**Shell (Mac, Linux):** ```curl -fsSL https://deno.land/x/install/install.sh | sh``` <br />
**PowerShell (Windows):** ```irm https://deno.land/install.ps1 | iex```

After installation, verify Deno is correctly installed with:
```
deno --version
```

## Installation Steps
Follow these steps to install and run the Synapic Search project on your local machine:

### 1. Clone the Repository
First, clone the project's source code from the GitHub repository. Open your terminal and run:
```
git clone https://github.com/yigitkabak/Synapic
cd Synapic
```

### 2. Automatic Creation of History File (backend/src/json/sites.json)
Your search history data will be stored locally in the `backend/src/json/sites.json` file. This file is automatically created when the application is first launched. You do not need to create it manually. However, if you wish to view or edit its contents, you will see it initialized as an empty JSON array `[]`.

### 3. Install Dependencies
Deno does not require a separate `npm install` step like Node.js. Dependencies are automatically downloaded and cached during the first run from the URLs specified in the `app.ts` file.

## Running the Application
After completing all installation steps, you can start the Synapic Search application.

1. Navigate to your project's backend directory:
```
cd backend
```

2. Run the following Deno command to start the application. This command grants permissions for network access (`--allow-net`), file reading (`--allow-read`), and writing (`--allow-write`) (required for saving history locally):
```
deno run --allow-net --allow-read --allow-write app.ts
```

You should see the message "Server started: http://localhost:8000" in the terminal.

3. Open your web browser and navigate to:
```
https://localhost:8000
```

You can now start using Synapic Search!

## Usage
- Searching: Type your query in the search bar on the homepage and press Enter or click the search icon.
- Search Types: On the search results page, use the buttons below the search bar to switch between search types (Web, Image, Video, News, Wiki).
- History: Access previous searches by navigating to the "History" page via the menu (click the three-line icon in the top right).
- Settings: Click the gear icon in the top right to manage your language preferences.
- Privacy & Terms: Click the "Privacy & Terms" link in the footer to read the app's data handling policies.

## Privacy Note
Synapic Search does not collect any personal information from users or send it to external servers. All data, such as search history and language preferences, is stored in the local storage of the device running the application (via the `sites.json` file). This means you retain full control over your data, and your privacy is maximally protected. The app uses external APIs to fetch search results from the internet, but no personal information is shared during these API calls.

# License
```
MIT License

Copyright (c) 2023 Aperture Labs.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
## Contributing
If you would like to contribute to the Synapic Search project, please visit the GitHub repository and feel free to submit a pull request. All kinds of contributions (bug fixes, new features, documentation improvements, etc.) are welcome.
## Contact

If you have any questions, feedback, or suggestions, please contact us at `yigitkabak@tuta.io`.

---

**Aperture Labs.**
