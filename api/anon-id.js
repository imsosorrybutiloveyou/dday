export default function handler(req, res) {
  const raw = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '')
    .split(',')[0].trim();

  let masked = '0.0';
  if (raw) {
    if (raw.includes(':')) {
      const parts = raw.split(':').filter(Boolean);
      masked = parts.slice(0, 2).join(':') || 'ipv6';
    } else {
      const parts = raw.split('.');
      if (parts.length >= 2) masked = `${parts[0]}.${parts[1]}`;
    }
  }

  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).json({ id: masked });
}
