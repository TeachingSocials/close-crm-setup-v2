// Vercel Serverless Function - wraps the Netlify function logic
const { handler } = require('../netlify/functions/setup');

module.exports = async function(req, res) {
  // Convert Vercel request to Netlify event format
    const chunks = [];
      for await (const chunk of req) {
          chunks.push(chunk);
            }
              const body = Buffer.concat(chunks).toString();

                const event = {
                    httpMethod: req.method,
                        body: body,
                            headers: req.headers,
                              };

                                const result = await handler(event, {});

                                  res.status(result.statusCode);
                                    Object.entries(result.headers || {}).forEach(([key, value]) => {
                                        res.setHeader(key, value);
                                          });
                                            res.end(result.body);
                                            };
