# n8n-nodes-linkedin

This is an n8n community node for automating LinkedIn interactions like profile viewing, connection requests, post engagement, and more. It uses a Puppeteer-based approach to handle the LinkedIn UI directly.

## Features

- **Profile Operations:** View profiles, send connection requests, message connections
- **Post Engagement:** Find posts, like, comment, and share
- **Session Management:** Optimize performance with session reuse
- **Rate Limiting:** Built-in protection against LinkedIn rate limits

## Installation

Follow these steps to install this custom node:

```bash
# Navigate to your n8n installation
cd ~/.n8n

# Install the node
npm install n8n-nodes-linkedin
```

## Configuration

1. Create a LinkedIn Browser credential in n8n
2. Add your LinkedIn username and password
3. Configure 2FA settings if necessary

## Usage

Check the examples folder for sample workflows that demonstrate:
- Connecting with profiles
- Engaging with posts
- Extracting profile information

## Notes

- Always be mindful of LinkedIn's terms of service
- Use reasonable delays between operations
- Consider the daily and hourly rate limits

## License

[MIT](LICENSE)

## Author

ALI BEG (mbeg937@gmail.com)

---

This node was created with n8n community node starter template.
