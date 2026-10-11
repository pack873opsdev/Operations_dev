export async function sendTemporaryPassword(email: string, password: string) {
  const sender=Deno.env.get('GMAIL_SENDER_EMAIL'),clientId=Deno.env.get('GMAIL_CLIENT_ID'),clientSecret=Deno.env.get('GMAIL_CLIENT_SECRET'),refreshToken=Deno.env.get('GMAIL_REFRESH_TOKEN');
  if(!sender||!clientId||!clientSecret||!refreshToken)throw new Error('Email service not configured');
  if(/[\r\n]/.test(email+sender))throw new Error('Invalid email address');
  const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:'refresh_token'})});
  if(!tokenResponse.ok)throw new Error('Gmail authorization failed');
  const token=await tokenResponse.json();
  if(!token.access_token)throw new Error('Gmail authorization failed');
  const message=[`From: ${sender}`,`To: ${email}`,'Subject: Pack 873 DEV - Volunteer login','MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','','Your Pack 873 DEV volunteer login is ready.',`Email: ${email}`,`Temporary password: ${password}`,'Website: https://pack873-operations-dev.pages.dev/#committee','','Sign in and choose your personal password before accessing the directory.'].join('\r\n');
  const raw=btoa(String.fromCharCode(...new TextEncoder().encode(message))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({raw})});
  if(!response.ok)throw new Error('Gmail did not accept the temporary-password email');
}
