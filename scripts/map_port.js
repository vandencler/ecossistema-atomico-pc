const natUpnp = require('nat-upnp');
const client = natUpnp.createClient();

console.log('Attempting to map port 5432 via UPNP...');

client.portMapping({
  public: 5432,
  private: 5432,
  ttl: 0 // indefinite
}, (err) => {
  if (err) {
    console.error('UPNP Mapping failed:', err.message);
    process.exit(1);
  } else {
    console.log('SUCCESS: Port 5432 is now mapped to public IP!');
    process.exit(0);
  }
});
