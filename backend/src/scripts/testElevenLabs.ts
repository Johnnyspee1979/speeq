const { ElevenLabsService } = require('../services/elevenLabsService');

async function testElevenLabs() {
  console.log('Testing ElevenLabs connection with the configured API key...');
  const text = 'Gefeliciteerd! De verbinding tussen SpeeQ en ElevenLabs is nu live en volledig operationeel.';
  try {
    const url = await ElevenLabsService.getSpokenAudioUrl(text);
    console.log('\n✅ SUCCES!');
    console.log('Spraakbestand gegenereerd en gecached op Supabase.');
    console.log('Beluister de audio hier:');
    console.log(url);
  } catch (error: any) {
    console.error('\n❌ FOUT BIJ TEST:', error?.response?.data ? JSON.stringify(error.response.data) : error.message);
  }
}

testElevenLabs();
