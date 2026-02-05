 // Twilio ↔ ElevenLabs Media Stream Bridge
 // This edge function handles WebSocket connections from Twilio and bridges to ElevenLabs
 
 const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 // Get signed URL for ElevenLabs WebSocket
 async function getSignedUrl(agentId: string): Promise<string> {
   const response = await fetch(
     `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
     {
       method: "GET",
       headers: {
         "xi-api-key": ELEVENLABS_API_KEY!,
       },
     }
   );
 
   if (!response.ok) {
     throw new Error(`Failed to get signed URL: ${response.statusText}`);
   }
 
   const data = await response.json();
   return data.signed_url;
 }
 
 Deno.serve(async (req) => {
   // Handle CORS
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   // Check for WebSocket upgrade
   const upgradeHeader = req.headers.get("upgrade") || "";
   
   if (upgradeHeader.toLowerCase() !== "websocket") {
     return new Response("Expected WebSocket upgrade", { status: 426 });
   }
 
   // Get agent ID from query params
   const url = new URL(req.url);
   const agentId = url.searchParams.get("agent_id");
   
   if (!agentId) {
     return new Response("Missing agent_id parameter", { status: 400 });
   }
 
   if (!ELEVENLABS_API_KEY) {
     return new Response("ELEVENLABS_API_KEY not configured", { status: 500 });
   }
 
   // Upgrade to WebSocket
   const { socket: twilioWs, response } = Deno.upgradeWebSocket(req);
 
   let elevenLabsWs: WebSocket | null = null;
   let streamSid: string | null = null;
   let callSid: string | null = null;
 
   twilioWs.onopen = async () => {
     console.log("[Twilio] WebSocket connected");
     
     try {
       // Connect to ElevenLabs
       const signedUrl = await getSignedUrl(agentId);
       elevenLabsWs = new WebSocket(signedUrl);
 
       elevenLabsWs.onopen = () => {
         console.log("[ElevenLabs] Connected to Conversational AI");
       };
 
       elevenLabsWs.onmessage = (event) => {
         try {
           const message = JSON.parse(event.data);
 
           switch (message.type) {
             case "conversation_initiation_metadata":
               console.log("[ElevenLabs] Received initiation metadata");
               break;
 
             case "audio":
               if (streamSid) {
                 const audioChunk = message.audio?.chunk || message.audio_event?.audio_base_64;
                 if (audioChunk) {
                   const audioData = {
                     event: "media",
                     streamSid,
                     media: {
                       payload: audioChunk,
                     },
                   };
                   twilioWs.send(JSON.stringify(audioData));
                 }
               }
               break;
 
             case "interruption":
               if (streamSid) {
                 twilioWs.send(JSON.stringify({
                   event: "clear",
                   streamSid,
                 }));
               }
               break;
 
             case "ping":
               if (message.ping_event?.event_id && elevenLabsWs) {
                 elevenLabsWs.send(JSON.stringify({
                   type: "pong",
                   event_id: message.ping_event.event_id,
                 }));
               }
               break;
 
             case "agent_response":
               console.log(`[Agent] ${message.agent_response_event?.agent_response}`);
               break;
 
             case "user_transcript":
               console.log(`[User] ${message.user_transcription_event?.user_transcript}`);
               break;
 
             default:
               console.log(`[ElevenLabs] Event: ${message.type}`);
           }
         } catch (error) {
           console.error("[ElevenLabs] Error processing message:", error);
         }
       };
 
       elevenLabsWs.onerror = (error) => {
         console.error("[ElevenLabs] WebSocket error:", error);
       };
 
       elevenLabsWs.onclose = () => {
         console.log("[ElevenLabs] Disconnected");
       };
 
     } catch (error) {
       console.error("[ElevenLabs] Setup error:", error);
     }
   };
 
   twilioWs.onmessage = (event) => {
     try {
       const msg = JSON.parse(event.data);
 
       switch (msg.event) {
         case "start":
           streamSid = msg.start.streamSid;
           callSid = msg.start.callSid;
           console.log(`[Twilio] Stream started - StreamSid: ${streamSid}, CallSid: ${callSid}`);
           break;
 
         case "media":
           if (elevenLabsWs?.readyState === WebSocket.OPEN) {
             const audioMessage = {
               user_audio_chunk: msg.media.payload,
             };
             elevenLabsWs.send(JSON.stringify(audioMessage));
           }
           break;
 
         case "stop":
           console.log(`[Twilio] Stream ${streamSid} ended`);
           if (elevenLabsWs?.readyState === WebSocket.OPEN) {
             elevenLabsWs.close();
           }
           break;
 
         default:
           if (msg.event !== "media") {
             console.log(`[Twilio] Event: ${msg.event}`);
           }
       }
     } catch (error) {
       console.error("[Twilio] Error processing message:", error);
     }
   };
 
   twilioWs.onclose = () => {
     console.log("[Twilio] Client disconnected");
     if (elevenLabsWs?.readyState === WebSocket.OPEN) {
       elevenLabsWs.close();
     }
   };
 
   twilioWs.onerror = (error) => {
     console.error("[Twilio] WebSocket error:", error);
   };
 
   return response;
 });