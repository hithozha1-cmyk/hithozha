-- Replaces the original 8-category taxonomy with a 2-level one (16 categories, 346
-- subcategories) covering the actual range of freelance work on Hithozha. Jobs and packages
-- now tag by the specific subcategory (e.g. "Logo design"), not the broad category (e.g.
-- "Graphics & Design") -- the old flat categories.slug was really playing the subcategory role.
--
-- Old category slugs are remapped to the closest new subcategory before the old rows are
-- replaced, so no existing job or package is orphaned:
--   video-editing  -> video-editing     (video-animation)
--   web-design     -> web-design        (graphics-design)
--   graphic-design -> logo-design       (graphics-design)
--   social-media   -> social-media-management (digital-marketing)
--   photography    -> photography       (lifestyle-personal)
--   tuition        -> academic-tutoring (education-training)
--   writing        -> blog-article-writing (writing-translation)
--   voice-over     -> voice-over        (music-audio)

-- ---------------------------------------------------------------------------
-- Detach jobs/service_packages from categories so the old rows can be replaced.
-- ---------------------------------------------------------------------------
alter table public.jobs drop constraint jobs_category_slug_fkey;
alter table public.service_packages drop constraint service_packages_category_slug_fkey;

update public.jobs set category_slug = case category_slug
  when 'video-editing' then 'video-editing'
  when 'web-design' then 'web-design'
  when 'graphic-design' then 'logo-design'
  when 'social-media' then 'social-media-management'
  when 'photography' then 'photography'
  when 'tuition' then 'academic-tutoring'
  when 'writing' then 'blog-article-writing'
  when 'voice-over' then 'voice-over'
  else category_slug
end
where category_slug in ('video-editing', 'web-design', 'graphic-design', 'social-media', 'photography', 'tuition', 'writing', 'voice-over');

update public.service_packages set category_slug = case category_slug
  when 'video-editing' then 'video-editing'
  when 'web-design' then 'web-design'
  when 'graphic-design' then 'logo-design'
  when 'social-media' then 'social-media-management'
  when 'photography' then 'photography'
  when 'tuition' then 'academic-tutoring'
  when 'writing' then 'blog-article-writing'
  when 'voice-over' then 'voice-over'
  else category_slug
end
where category_slug in ('video-editing', 'web-design', 'graphic-design', 'social-media', 'photography', 'tuition', 'writing', 'voice-over');

delete from public.categories;

-- ---------------------------------------------------------------------------
-- New top-level categories (16): browse/grouping only, nothing references these directly.
-- ---------------------------------------------------------------------------
insert into public.categories (slug, name_en, name_ta, icon, sort_order) values
  ('writing-translation', 'Writing & Translation', 'எழுத்து மற்றும் மொழிபெயர்ப்பு', 'pen-line', 1),
  ('graphics-design', 'Graphics & Design', 'கிராஃபிக்ஸ் & வடிவமைப்பு', 'palette', 2),
  ('video-animation', 'Video & Animation', 'வீடியோ & அனிமேஷன்', 'video', 3),
  ('music-audio', 'Music & Audio', 'இசை & ஆடியோ', 'music', 4),
  ('programming-tech', 'Programming & Tech', 'புரோகிராமிங் & டெக்', 'code', 5),
  ('ai-data', 'AI & Data', 'AI & டேட்டா', 'brain', 6),
  ('digital-marketing', 'Digital Marketing', 'டிஜிட்டல் மார்க்கெட்டிங்', 'megaphone', 7),
  ('business-finance', 'Business & Finance', 'வணிகம் & நிதி', 'briefcase', 8),
  ('admin-support', 'Admin & Customer Support', 'நிர்வாகம் & வாடிக்கையாளர் ஆதரவு', 'headset', 9),
  ('engineering-architecture', 'Engineering & Architecture', 'இன்ஜினியரிங் & கட்டிடக்கலை', 'ruler', 10),
  ('education-training', 'Education & Training', 'கல்வி & பயிற்சி', 'graduation-cap', 11),
  ('health-wellness', 'Health & Wellness', 'ஆரோக்கியம் & நல்வாழ்வு', 'heart-pulse', 12),
  ('lifestyle-personal', 'Lifestyle & Personal Services', 'வாழ்க்கை முறை & தனிப்பட்ட சேவைகள்', 'sparkles', 13),
  ('gaming-esports', 'Gaming & Esports', 'கேமிங் & இ-ஸ்போர்ட்ஸ்', 'gamepad-2', 14),
  ('web3-emerging', 'Web3 & Emerging Tech', 'Web3 & வளர்ந்துவரும் தொழில்நுட்பம்', 'boxes', 15),
  ('digital-products', 'Digital Products & Templates', 'டிஜிட்டல் தயாரிப்புகள் & டெம்ப்ளேட்கள்', 'package', 16);


-- ---------------------------------------------------------------------------
-- Subcategories (346): the granular service type a job or package actually tags.
-- ---------------------------------------------------------------------------
create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_slug text not null references public.categories (slug) on delete cascade,
  slug text not null unique,
  name_en text not null,
  name_ta text not null,
  description_en text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create index subcategories_category_slug_idx on public.subcategories (category_slug);

alter table public.subcategories enable row level security;

revoke all on public.subcategories from anon, authenticated;
grant select on public.subcategories to anon, authenticated;

create policy "subcategories are readable by everyone"
  on public.subcategories for select
  to anon, authenticated
  using (true);

insert into public.subcategories (category_slug, slug, name_en, name_ta, description_en, sort_order) values
  ('writing-translation', 'blog-article-writing', 'Blog & Article Writing', 'வலைப்பதிவு & கட்டுரை எழுத்து', 'SEO articles, long-form posts, listicles', 1),
  ('writing-translation', 'copywriting', 'Copywriting', 'விளம்பர எழுத்து (காப்பிரைட்டிங்)', 'Sales pages, ad copy, landing page copy', 2),
  ('writing-translation', 'website-content', 'Website Content', 'வலைத்தள உள்ளடக்கம்', 'Homepage, about, service page content', 3),
  ('writing-translation', 'technical-writing', 'Technical Writing', 'தொழில்நுட்ப எழுத்து', 'API docs, manuals, SOPs, user guides', 4),
  ('writing-translation', 'ghostwriting', 'Ghostwriting', 'கோஸ்ட் ரைட்டிங் (மறைவெழுத்து)', 'Books, posts, articles published under client name', 5),
  ('writing-translation', 'ux-writing', 'UX Writing & Microcopy', 'UX எழுத்து & மைக்ரோகாப்பி', 'In-app text, buttons, error messages', 6),
  ('writing-translation', 'script-writing', 'Script Writing', 'ஸ்கிரிப்ட் எழுத்து', 'YouTube, ads, short films, podcasts', 7),
  ('writing-translation', 'creative-writing', 'Creative Writing & Fiction', 'படைப்பு எழுத்து & கற்பனைக் கதைகள்', 'Stories, novels, poetry, web novels', 8),
  ('writing-translation', 'resume-cover-letter', 'Resume & Cover Letter', 'ரெஸ்யூம் & கவர் லெட்டர்', 'CV writing, LinkedIn profile optimization', 9),
  ('writing-translation', 'academic-writing', 'Academic Writing & Editing', 'கல்வித் துறை எழுத்து & எடிட்டிங்', 'Thesis, journal papers, formatting', 10),
  ('writing-translation', 'legal-writing', 'Legal Writing', 'சட்ட எழுத்து', 'Contracts, NDAs, policies, legal blogs', 11),
  ('writing-translation', 'medical-writing', 'Medical Writing', 'மருத்துவ எழுத்து', 'Clinical reports, regulatory documents', 12),
  ('writing-translation', 'grant-proposal-writing', 'Grant & Proposal Writing', 'நிதியுதவி & முன்மொழிவு எழுத்து', 'Funding proposals, tenders, RFP responses', 13),
  ('writing-translation', 'product-descriptions', 'Product Descriptions', 'தயாரிப்பு விளக்கங்கள்', 'E-commerce listings, catalog copy', 14),
  ('writing-translation', 'email-newsletter', 'Email & Newsletter Writing', 'மின்னஞ்சல் & செய்திமடல் எழுத்து', 'Campaigns, drip sequences, newsletters', 15),
  ('writing-translation', 'social-media-captions', 'Social Media Captions & Hooks', 'சமூக ஊடக கேப்ஷன்கள் & ஹூக்குகள்', 'Reels hooks, captions, carousel copy', 16),
  ('writing-translation', 'speech-writing', 'Speech & Presentation Writing', 'பேச்சு & விளக்கக்காட்சி எழுத்து', 'Keynotes, weddings, event speeches', 17),
  ('writing-translation', 'proofreading-editing', 'Proofreading & Editing', 'ப்ரூஃப்ரீடிங் & எடிட்டிங்', 'Grammar, style, consistency checks', 18),
  ('writing-translation', 'translation', 'Translation', 'மொழிபெயர்ப்பு', 'Document translation between languages', 19),
  ('writing-translation', 'localization', 'Localization', 'உள்ளூர்மயமாக்கல்', 'Cultural adaptation for new markets', 20),
  ('writing-translation', 'subtitling-captioning', 'Subtitling & Captioning', 'சப்டைட்டில் & கேப்ஷனிங்', 'SRT files, timed captions, closed captions', 21),
  ('writing-translation', 'transcription', 'Transcription', 'ஒலிப்பெயர்ப்பு (டிரான்ஸ்கிரிப்ஷன்)', 'Audio/video to text, legal, medical', 22),
  ('writing-translation', 'interpretation', 'Interpretation', 'வாய்மொழி மொழிபெயர்ப்பு (இன்டர்ப்ரிடேஷன்)', 'Live simultaneous or consecutive interpreting', 23),
  ('writing-translation', 'ai-content-editing', 'AI Content Editing', 'AI உள்ளடக்க எடிட்டிங்', 'Humanizing AI drafts, prompt-based writing', 24),
  ('graphics-design', 'logo-design', 'Logo Design', 'லோகோ வடிவமைப்பு', 'Brand marks, wordmarks, monograms', 1),
  ('graphics-design', 'brand-identity', 'Brand Identity & Guidelines', 'பிராண்ட் அடையாளம் & வழிகாட்டுதல்கள்', 'Full brand kit, colors, typography, usage rules', 2),
  ('graphics-design', 'social-media-design', 'Social Media Design', 'சமூக ஊடக வடிவமைப்பு', 'Posts, stories, carousels, ad creatives', 3),
  ('graphics-design', 'thumbnail-design', 'Thumbnail Design', 'தம்பைனெயில் வடிவமைப்பு', 'YouTube and video thumbnails', 4),
  ('graphics-design', 'poster-flyer-design', 'Poster & Flyer Design', 'போஸ்டர் & ஃப்ளையர் வடிவமைப்பு', 'Event posters, flyers, pamphlets, banners', 5),
  ('graphics-design', 'ui-design', 'UI Design', 'UI வடிவமைப்பு', 'App and website screen design', 6),
  ('graphics-design', 'ux-research', 'UX Design & Research', 'UX வடிவமைப்பு & ஆராய்ச்சி', 'Wireframes, user flows, usability testing', 7),
  ('graphics-design', 'web-design', 'Web Design', 'வலைத்தள வடிவமைப்பு', 'Website layouts in Figma/XD', 8),
  ('graphics-design', 'illustration', 'Illustration', 'இலஸ்ட்ரேஷன் (சித்திரக் கலை)', 'Custom art, editorial and digital illustration', 9),
  ('graphics-design', 'character-design', 'Character & Mascot Design', 'கேரக்டர் & மாஸ்காட் வடிவமைப்பு', 'Brand mascots, game and anime characters', 10),
  ('graphics-design', 'concept-art', 'Concept Art', 'கான்செப்ட் ஆர்ட்', 'Environments, props, key art for games/film', 11),
  ('graphics-design', 'comic-manga-art', 'Comic & Manga Art', 'காமிக் & மங்கா கலை', 'Panels, inking, coloring, webtoons', 12),
  ('graphics-design', 'pixel-voxel-art', 'Pixel & Voxel Art', 'பிக்சல் & வாக்செல் ஆர்ட்', 'Retro sprites, blocky 3D assets', 13),
  ('graphics-design', 'vector-icon-design', 'Vector & Icon Design', 'வெக்டர் & ஐகான் வடிவமைப்பு', 'SVG icon sets, line icons, pictograms', 14),
  ('graphics-design', 'presentation-design', 'Presentation Design', 'விளக்கக்காட்சி வடிவமைப்பு', 'Pitch decks, investor decks, slide templates', 15),
  ('graphics-design', 'infographic-design', 'Infographic & Data Design', 'இன்ஃபோகிராஃபிக் & டேட்டா வடிவமைப்பு', 'Visual data storytelling, charts', 16),
  ('graphics-design', 'packaging-label-design', 'Packaging & Label Design', 'பேக்கேஜிங் & லேபிள் வடிவமைப்பு', 'Boxes, labels, dielines, print-ready files', 17),
  ('graphics-design', 'book-cover-design', 'Book & Album Cover Design', 'புத்தக & ஆல்பம் அட்டை வடிவமைப்பு', 'KDP covers, music artwork', 18),
  ('graphics-design', 'tshirt-merch-design', 'T-Shirt & Merch Design', 'டி-ஷர்ட் & மெர்ச் வடிவமைப்பு', 'Print-on-demand, apparel graphics', 19),
  ('graphics-design', 'typography-font-design', 'Typography & Font Design', 'டைப்போகிராஃபி & எழுத்துரு வடிவமைப்பு', 'Custom typefaces, lettering, calligraphy', 20),
  ('graphics-design', 'photo-editing-retouching', 'Photo Editing & Retouching', 'புகைப்பட எடிட்டிங் & ரீடச்சிங்', 'Skin, product, real estate retouching', 21),
  ('graphics-design', 'background-removal', 'Background Removal & Clipping', 'பின்னணி நீக்குதல் & கிளிப்பிங்', 'Bulk e-commerce image cleanup', 22),
  ('graphics-design', 'photo-restoration', 'Photo Restoration', 'புகைப்பட மறுசீரமைப்பு', 'Repairing and colorizing old photos', 23),
  ('graphics-design', 'signage-wrap-design', 'Signage & Vehicle Wrap Design', 'சைன்போர்டு & வாகன ராப் வடிவமைப்பு', 'Shop boards, hoardings, car wraps', 24),
  ('graphics-design', 'ai-image-art', 'AI Image & Generative Art', 'AI இமேஜ் & ஜெனரேட்டிவ் ஆர்ட்', 'Midjourney, Stable Diffusion, LoRA training', 25),
  ('graphics-design', 'tattoo-design', 'Tattoo Design', 'டாட்டூ வடிவமைப்பு', 'Custom flash and tattoo artwork', 26),
  ('graphics-design', 'pattern-textile-design', 'Pattern & Textile Design', 'பேட்டர்ன் & துணி வடிவமைப்பு', 'Fabric prints, repeat patterns', 27),
  ('graphics-design', 'fashion-design', 'Fashion Design & Tech Packs', 'ஃபேஷன் வடிவமைப்பு & டெக் பேக்ஸ்', 'Garment design, spec sheets', 28),
  ('graphics-design', 'jewelry-cad-design', 'Jewelry CAD Design', 'நகை CAD வடிவமைப்பு', '3D jewelry models, print-ready files', 29),
  ('video-animation', 'video-editing', 'Video Editing', 'வீடியோ எடிட்டிங்', 'Long-form, YouTube, corporate videos', 1),
  ('video-animation', 'shorts-reels-editing', 'Shorts & Reels Editing', 'ஷார்ட்ஸ் & ரீல்ஸ் எடிட்டிங்', 'Vertical short-form, captions, hooks', 2),
  ('video-animation', 'wedding-event-editing', 'Wedding & Event Editing', 'திருமணம் & நிகழ்ச்சி எடிட்டிங்', 'Highlights, teasers, full ceremony edits', 3),
  ('video-animation', 'podcast-editing-video', 'Podcast Video Editing', 'பாட்காஸ்ட் வீடியோ எடிட்டிங்', 'Multi-cam talking head edits', 4),
  ('video-animation', 'motion-graphics', 'Motion Graphics', 'மோஷன் கிராஃபிக்ஸ்', 'After Effects animations, lower thirds', 5),
  ('video-animation', '2d-animation', '2D Animation', '2D அனிமேஷன்', 'Frame-by-frame, cutout, explainer animation', 6),
  ('video-animation', '3d-animation', '3D Animation', '3D அனிமேஷன்', 'Character, camera, product animation', 7),
  ('video-animation', 'whiteboard-animation', 'Whiteboard & Explainer Animation', 'ஒயிட்போர்டு & எக்ஸ்ப்ளெய்னர் அனிமேஷன்', 'Hand-drawn explainer style videos', 8),
  ('video-animation', 'vfx-compositing', 'VFX & Compositing', 'VFX & காம்போசிட்டிங்', 'Cleanup, green screen, effects', 9),
  ('video-animation', 'rotoscoping-tracking', 'Rotoscoping & Tracking', 'ரோட்டோஸ்கோபிங் & டிராக்கிங்', 'Frame masking, camera match-move', 10),
  ('video-animation', 'color-grading', 'Color Grading', 'கலர் கிரேடிங்', 'DaVinci Resolve grading, LUTs', 11),
  ('video-animation', 'title-intro-design', 'Titles & Intro Design', 'டைட்டில் & இன்ட்ரோ வடிவமைப்பு', 'Opening sequences, logo stings', 12),
  ('video-animation', 'videography', 'Videography & Shoots', 'வீடியோகிராஃபி & ஷூட்ஸ்', 'Events, corporate, product shoots', 13),
  ('video-animation', 'drone-videography', 'Drone & Aerial Videography', 'ட்ரோன் & ஏரியல் வீடியோகிராஃபி', 'Aerial shoots, property flyovers', 14),
  ('video-animation', 'cinematography', 'Cinematography & DOP', 'ஒளிப்பதிவு (சினிமாட்டோகிராஃபி)', 'Camera and lighting direction', 15),
  ('video-animation', 'live-streaming', 'Live Streaming Production', 'லைவ் ஸ்ட்ரீமிங் தயாரிப்பு', 'OBS, vMix, multi-cam streaming', 16),
  ('video-animation', 'stream-overlay-design', 'Stream Overlays & Alerts', 'ஸ்ட்ரீம் ஓவர்லே & அலர்ட் வடிவமைப்பு', 'Twitch/YouTube graphics packages', 17),
  ('video-animation', 'vtuber-live2d', 'VTuber & Live2D Rigging', 'VTuber & Live2D ரிக்கிங்', 'Avatar models, rigging, expressions', 18),
  ('video-animation', 'video-ads-production', 'Video Ads Production', 'வீடியோ விளம்பர தயாரிப்பு', 'Performance ad creatives, UGC-style ads', 19),
  ('video-animation', 'real-estate-video', 'Real Estate Video Tours', 'ரியல் எஸ்டேட் வீடியோ டூர்ஸ்', 'Property walkthroughs and edits', 20),
  ('music-audio', 'voice-over', 'Voice Over', 'குரல் பதிவு', 'Ads, explainers, IVR, narration', 1),
  ('music-audio', 'audiobook-narration', 'Audiobook Narration', 'ஆடியோபுக் விவரணை', 'Full book narration and QC', 2),
  ('music-audio', 'dubbing', 'Dubbing & Voice Matching', 'டப்பிங் & குரல் பொருத்தம்', 'Language dubs, lip-sync dubbing', 3),
  ('music-audio', 'podcast-editing-audio', 'Podcast Editing', 'பாட்காஸ்ட் எடிட்டிங்', 'Cleanup, mixing, intros, show notes', 4),
  ('music-audio', 'music-production', 'Music Production & Beats', 'இசை தயாரிப்பு & பீட்ஸ்', 'Full tracks, beats, backing music', 5),
  ('music-audio', 'mixing-mastering', 'Mixing & Mastering', 'மிக்சிங் & மாஸ்டரிங்', 'Balance, EQ, loudness, final polish', 6),
  ('music-audio', 'sound-design', 'Sound Design & SFX', 'சவுண்ட் டிசைன் & SFX', 'Effects for games, film, apps', 7),
  ('music-audio', 'foley', 'Foley Recording', 'ஃபோலி பதிவு', 'Real-world recorded sound effects', 8),
  ('music-audio', 'composing', 'Composing & Scoring', 'இசை அமைப்பு & ஸ்கோரிங்', 'Film scores, game music, background score', 9),
  ('music-audio', 'jingle-sonic-branding', 'Jingles & Sonic Branding', 'ஜிங்கிள் & சோனிக் பிராண்டிங்', 'Ad jingles, brand sound logos', 10),
  ('music-audio', 'session-musician', 'Session Musicians', 'செஷன் இசைக்கலைஞர்கள்', 'Remote instrument recording', 11),
  ('music-audio', 'singing-vocals', 'Singing & Vocals', 'பாடல் & வோக்கல்ஸ்', 'Lead vocals, backing vocals, covers', 12),
  ('music-audio', 'songwriting-lyrics', 'Songwriting & Lyrics', 'பாடல் வரி எழுத்து', 'Original lyrics, toplines, melodies', 13),
  ('music-audio', 'music-transcription', 'Music Transcription & Notation', 'இசை டிரான்ஸ்கிரிப்ஷன் & நொட்டேஷன்', 'Audio to sheet music, tabs', 14),
  ('music-audio', 'dj-remix', 'DJ Sets & Remixes', 'DJ செட் & ரீமிக்ஸ்', 'Remixes, mashups, event sets', 15),
  ('music-audio', 'audio-restoration', 'Audio Restoration', 'ஆடியோ மறுசீரமைப்பு', 'Noise, hum, click removal', 16),
  ('music-audio', 'ai-voice-tts', 'AI Voice & TTS', 'AI குரல் & TTS', 'Voice cloning, TTS pipelines', 17),
  ('music-audio', 'sample-preset-packs', 'Sample & Preset Packs', 'சாம்பிள் & ப்ரீசெட் பேக்ஸ்', 'Drum kits, loops, synth presets', 18),
  ('programming-tech', 'frontend-development', 'Frontend Development', 'ஃப்ரண்ட்எண்ட் டெவலப்மென்ட்', 'React, Vue, Next.js, Svelte', 1),
  ('programming-tech', 'backend-development', 'Backend Development', 'பேக்எண்ட் டெவலப்மென்ட்', 'APIs, databases, server logic', 2),
  ('programming-tech', 'fullstack-development', 'Full-Stack Development', 'ஃபுல்-ஸ்டாக் டெவலப்மென்ட்', 'End-to-end web applications', 3),
  ('programming-tech', 'mobile-app-development', 'Mobile App Development', 'மொபைல் ஆப் டெவலப்மென்ட்', 'Android, iOS, Flutter, React Native', 4),
  ('programming-tech', 'wordpress-development', 'WordPress Development', 'வேர்ட்பிரஸ் டெவலப்மென்ட்', 'Themes, plugins, Elementor builds', 5),
  ('programming-tech', 'shopify-development', 'Shopify Development', 'ஷாபிஃபை டெவலப்மென்ட்', 'Liquid themes, apps, store setup', 6),
  ('programming-tech', 'ecommerce-development', 'E-commerce Development', 'இ-காமர்ஸ் டெவலப்மென்ட்', 'WooCommerce, Magento, custom stores', 7),
  ('programming-tech', 'nocode-development', 'No-Code Development', 'நோ-கோட் டெவலப்மென்ட்', 'Webflow, Framer, Bubble, Wix', 8),
  ('programming-tech', 'game-development', 'Game Development', 'கேம் டெவலப்மென்ட்', 'Unity, Unreal, Godot, mobile games', 9),
  ('programming-tech', 'ar-vr-development', 'AR / VR / XR Development', 'AR / VR / XR டெவலப்மென்ட்', 'Unity XR, WebXR, immersive apps', 10),
  ('programming-tech', 'desktop-app-development', 'Desktop App Development', 'டெஸ்க்டாப் ஆப் டெவலப்மென்ட்', 'Electron, Tauri, Qt, .NET apps', 11),
  ('programming-tech', 'browser-extensions', 'Browser Extensions', 'பிரவுசர் எக்ஸ்டென்ஷன்கள்', 'Chrome, Firefox, Edge add-ons', 12),
  ('programming-tech', 'api-integration', 'API Integration', 'API இன்டிகிரேஷன்', 'Third-party APIs, webhooks, payments', 13),
  ('programming-tech', 'automation-scripting', 'Automation & Scripting', 'ஆட்டோமேஷன் & ஸ்கிரிப்டிங்', 'Python, Bash, task automation', 14),
  ('programming-tech', 'workflow-automation', 'Workflow Automation', 'ஒர்க்ஃப்ளோ ஆட்டோமேஷன்', 'Zapier, Make, n8n, RPA', 15),
  ('programming-tech', 'bot-development', 'Bot Development', 'பாட் டெவலப்மென்ட்', 'WhatsApp, Telegram, Discord, Slack bots', 16),
  ('programming-tech', 'web-scraping', 'Web Scraping & Crawlers', 'வெப் ஸ்கிரேப்பிங் & க்ரால்லர்கள்', 'Data extraction, anti-bot handling', 17),
  ('programming-tech', 'devops-cicd', 'DevOps & CI/CD', 'DevOps & CI/CD', 'Docker, Kubernetes, pipelines', 18),
  ('programming-tech', 'cloud-architecture', 'Cloud & Infrastructure', 'கிளவுட் & இன்ஃப்ராஸ்ட்ரக்சர்', 'AWS, GCP, Azure setup and scaling', 19),
  ('programming-tech', 'database-admin', 'Database Administration', 'டேட்டாபேஸ் நிர்வாகம்', 'Tuning, migrations, backups', 20),
  ('programming-tech', 'data-engineering', 'Data Engineering', 'டேட்டா இன்ஜினியரிங்', 'ETL pipelines, warehouses, streaming', 21),
  ('programming-tech', 'embedded-iot', 'Embedded & IoT', 'எம்பெடட் & IoT', 'ESP32, Arduino, firmware, MQTT', 22),
  ('programming-tech', 'robotics-programming', 'Robotics Programming', 'ரோபாடிக்ஸ் புரோகிராமிங்', 'ROS, motion planning, control systems', 23),
  ('programming-tech', 'industrial-automation', 'PLC & Industrial Automation', 'PLC & இண்டஸ்ட்ரியல் ஆட்டோமேஷன்', 'SCADA, HMI, ladder logic', 24),
  ('programming-tech', 'blockchain-development', 'Blockchain Development', 'பிளாக்செயின் டெவலப்மென்ட்', 'Smart contracts, dApps, Solidity', 25),
  ('programming-tech', 'smart-contract-audit', 'Smart Contract Auditing', 'ஸ்மார்ட் காண்ட்ராக்ட் ஆடிட்டிங்', 'Security review of on-chain code', 26),
  ('programming-tech', 'qa-manual-testing', 'QA & Manual Testing', 'QA & மேனுவல் டெஸ்டிங்', 'Test cases, bug reports, regression', 27),
  ('programming-tech', 'test-automation', 'Test Automation', 'டெஸ்ட் ஆட்டோமேஷன்', 'Playwright, Selenium, Cypress', 28),
  ('programming-tech', 'cybersecurity', 'Cybersecurity & Pentesting', 'சைபர் செக்யூரிட்டி & பென்டெஸ்டிங்', 'Vulnerability assessment, hardening', 29),
  ('programming-tech', 'reverse-engineering', 'Reverse Engineering', 'ரிவர்ஸ் இன்ஜினியரிங்', 'Binary analysis, malware research', 30),
  ('programming-tech', 'code-review-refactoring', 'Code Review & Refactoring', 'கோட் ரிவ்யூ & ரீஃபேக்டரிங்', 'Legacy cleanup, performance fixes', 31),
  ('programming-tech', 'legacy-migration', 'Legacy System Migration', 'லெகஸி சிஸ்டம் மைகிரேஷன்', 'Old PHP, VB, COBOL modernization', 32),
  ('programming-tech', 'software-architecture', 'Software Architecture', 'சாஃப்ட்வேர் ஆர்க்கிடெக்சர்', 'System design, tech documentation', 33),
  ('programming-tech', 'crm-erp-development', 'CRM & ERP Development', 'CRM & ERP டெவலப்மென்ட்', 'Salesforce, SAP, Odoo, Zoho', 34),
  ('programming-tech', 'accessibility-engineering', 'Accessibility (a11y)', 'அக்சசிபிலிட்டி (a11y)', 'WCAG audits and remediation', 35),
  ('programming-tech', 'performance-optimization', 'Performance Optimization', 'செயல்திறன் மேம்பாடு', 'Core Web Vitals, load speed, caching', 36),
  ('programming-tech', 'it-support-sysadmin', 'IT Support & SysAdmin', 'IT சப்போர்ட் & சிஸ்அட்மின்', 'Server maintenance, networks, helpdesk', 37),
  ('programming-tech', 'technical-consulting', 'Technical Consulting / CTO', 'தொழில்நுட்ப ஆலோசனை / CTO', 'Fractional CTO, tech strategy', 38),
  ('ai-data', 'data-analysis', 'Data Analysis', 'டேட்டா பகுப்பாய்வு', 'Insights, reports, exploratory analysis', 1),
  ('ai-data', 'data-visualization-bi', 'Dashboards & BI', 'டாஷ்போர்டு & BI', 'Power BI, Tableau, Looker, Metabase', 2),
  ('ai-data', 'data-science', 'Data Science & Modeling', 'டேட்டா சயின்ஸ் & மாடலிங்', 'Predictive models, statistics', 3),
  ('ai-data', 'machine-learning', 'Machine Learning Engineering', 'மெஷின் லேர்னிங் இன்ஜினியரிங்', 'Training, deployment, MLOps', 4),
  ('ai-data', 'computer-vision', 'Computer Vision', 'கம்ப்யூட்டர் விஷன்', 'Detection, OCR, segmentation', 5),
  ('ai-data', 'nlp-chatbots', 'NLP & Chatbots', 'NLP & சாட்பாட்கள்', 'Text models, conversational AI', 6),
  ('ai-data', 'llm-finetuning', 'LLM Fine-Tuning', 'LLM ஃபைன்-டியூனிங்', 'LoRA, dataset prep, evaluation', 7),
  ('ai-data', 'ai-agents-rag', 'AI Agents & RAG Systems', 'AI ஏஜெண்ட்ஸ் & RAG சிஸ்டம்ஸ்', 'Tool-using agents, vector search', 8),
  ('ai-data', 'prompt-engineering', 'Prompt Engineering', 'ப்ராம்ப்ட் இன்ஜினியரிங்', 'System prompts, evals, optimization', 9),
  ('ai-data', 'ai-automation-setup', 'AI Automation Setup', 'AI ஆட்டோமேஷன் அமைப்பு', 'AI workflows for business ops', 10),
  ('ai-data', 'data-annotation', 'Data Annotation & Labeling', 'டேட்டா அனோடேஷன் & லேபிளிங்', 'Bounding boxes, tagging, transcripts', 11),
  ('ai-data', 'data-entry', 'Data Entry', 'டேட்டா என்ட்ரி', 'Bulk input, form filling, copy-paste work', 12),
  ('ai-data', 'data-cleaning', 'Data Cleaning', 'டேட்டா க்ளீனிங்', 'Deduplication, normalization, formatting', 13),
  ('ai-data', 'web-research', 'Web Research', 'வெப் ஆராய்ச்சி', 'Lists, lead data, market information', 14),
  ('ai-data', 'survey-design-analysis', 'Survey Design & Analysis', 'சர்வே வடிவமைப்பு & பகுப்பாய்வு', 'Questionnaires, SPSS, statistical results', 15),
  ('ai-data', 'statistics-consulting', 'Statistics Consulting', 'புள்ளியியல் ஆலோசனை', 'R, SPSS, hypothesis testing, biostatistics', 16),
  ('ai-data', 'gis-geospatial', 'GIS & Geospatial Analysis', 'GIS & புவியியல் பகுப்பாய்வு', 'QGIS, mapping, remote sensing', 17),
  ('ai-data', 'bioinformatics', 'Bioinformatics', 'பயோஇன்ஃபர்மேட்டிக்ஸ்', 'Genomics pipelines, sequence analysis', 18),
  ('ai-data', 'excel-spreadsheets', 'Excel & Spreadsheets', 'Excel & ஸ்பிரெட்ஷீட்கள்', 'Formulas, macros, VBA, templates', 19),
  ('digital-marketing', 'seo', 'SEO', 'SEO', 'On-page, technical, off-page optimization', 1),
  ('digital-marketing', 'local-seo', 'Local SEO & Google Business', 'லோக்கல் SEO & Google Business', 'Maps ranking, local listings', 2),
  ('digital-marketing', 'link-building', 'Link Building & Outreach', 'லிங்க் பில்டிங் & அவுட்ரீச்', 'Backlinks, guest posts, digital PR', 3),
  ('digital-marketing', 'aeo-geo', 'AI Search Optimization (AEO/GEO)', 'AI சர்ச் ஆப்டிமைசேஷன் (AEO/GEO)', 'Visibility inside AI answers', 4),
  ('digital-marketing', 'google-ads', 'Google Ads', 'Google விளம்பரங்கள்', 'Search, Shopping, Performance Max', 5),
  ('digital-marketing', 'meta-ads', 'Meta Ads (Facebook & Instagram)', 'Meta விளம்பரங்கள் (Facebook & Instagram)', 'Campaign setup, scaling, creatives', 6),
  ('digital-marketing', 'tiktok-reels-ads', 'TikTok & Short-Video Ads', 'TikTok & ஷார்ட்-வீடியோ விளம்பரங்கள்', 'Vertical ad campaigns', 7),
  ('digital-marketing', 'linkedin-ads', 'LinkedIn Ads', 'LinkedIn விளம்பரங்கள்', 'B2B lead generation campaigns', 8),
  ('digital-marketing', 'amazon-marketplace-ads', 'Marketplace Ads', 'மார்க்கெட்பிளேஸ் விளம்பரங்கள்', 'Amazon, Flipkart, Meesho PPC', 9),
  ('digital-marketing', 'social-media-management', 'Social Media Management', 'சமூக ஊடக மேலாண்மை', 'Posting, scheduling, engagement', 10),
  ('digital-marketing', 'community-management', 'Community Management', 'கம்யூனிட்டி மேலாண்மை', 'Discord, Telegram, WhatsApp groups', 11),
  ('digital-marketing', 'influencer-marketing', 'Influencer Marketing', 'இன்ஃப்ளூயென்சர் மார்க்கெட்டிங்', 'Creator sourcing, campaign management', 12),
  ('digital-marketing', 'ugc-creation', 'UGC Creation', 'UGC உருவாக்கம்', 'Brand content filmed by creators', 13),
  ('digital-marketing', 'email-marketing', 'Email Marketing', 'மின்னஞ்சல் மார்க்கெட்டிங்', 'Campaigns, flows, Klaviyo, Mailchimp', 14),
  ('digital-marketing', 'whatsapp-sms-marketing', 'WhatsApp & SMS Marketing', 'WhatsApp & SMS மார்க்கெட்டிங்', 'Broadcast funnels, automation', 15),
  ('digital-marketing', 'marketing-automation', 'Marketing Automation', 'மார்க்கெட்டிங் ஆட்டோமேஷன்', 'HubSpot, GoHighLevel, workflows', 16),
  ('digital-marketing', 'funnel-building', 'Funnel & Landing Pages', 'ஃபனல் & லேண்டிங் பேஜ்கள்', 'Sales funnels, opt-in pages', 17),
  ('digital-marketing', 'conversion-optimization', 'Conversion Rate Optimization', 'கன்வர்ஷன் ரேட் ஆப்டிமைசேஷன்', 'A/B testing, funnel analysis', 18),
  ('digital-marketing', 'content-strategy', 'Content Strategy', 'உள்ளடக்க உத்தி', 'Editorial calendars, topic planning', 19),
  ('digital-marketing', 'brand-strategy', 'Brand Strategy', 'பிராண்ட் உத்தி', 'Positioning, messaging, naming', 20),
  ('digital-marketing', 'public-relations', 'Public Relations', 'பொது தொடர்பு (PR)', 'Media outreach, press releases', 21),
  ('digital-marketing', 'reputation-management', 'Reputation Management', 'நற்பெயர் மேலாண்மை', 'Reviews, ORM, crisis response', 22),
  ('digital-marketing', 'marketing-analytics', 'Marketing Analytics', 'மார்க்கெட்டிங் அனலிட்டிக்ஸ்', 'GA4, GTM, attribution, tracking setup', 23),
  ('digital-marketing', 'aso', 'App Store Optimization', 'ஆப் ஸ்டோர் ஆப்டிமைசேஷன்', 'App listing ranking and conversion', 24),
  ('digital-marketing', 'affiliate-marketing', 'Affiliate Marketing', 'அஃபிலியேட் மார்க்கெட்டிங்', 'Program setup, affiliate recruitment', 25),
  ('digital-marketing', 'youtube-channel-growth', 'YouTube Channel Growth', 'YouTube சேனல் வளர்ச்சி', 'Video SEO, packaging, strategy', 26),
  ('digital-marketing', 'ecommerce-store-management', 'E-commerce Store Management', 'இ-காமர்ஸ் ஸ்டோர் மேலாண்மை', 'Listings, catalog, order ops', 27),
  ('business-finance', 'business-plan', 'Business Plans', 'வணிகத் திட்டங்கள்', 'Investor-ready plans, feasibility studies', 1),
  ('business-finance', 'financial-modeling', 'Financial Modeling', 'நிதி மாடலிங்', '3-statement models, DCF, projections', 2),
  ('business-finance', 'pitch-deck-consulting', 'Pitch Deck Consulting', 'பிட்ச் டெக் ஆலோசனை', 'Narrative, numbers, investor decks', 3),
  ('business-finance', 'bookkeeping', 'Bookkeeping', 'கணக்குப் பதிவு (புக்கீப்பிங்)', 'Ledgers, Tally, QuickBooks, Zoho Books', 4),
  ('business-finance', 'accounting', 'Accounting', 'கணக்கியல்', 'Financial statements, period closing', 5),
  ('business-finance', 'tax-gst', 'Tax & GST Filing', 'வரி & GST தாக்கல்', 'Returns, compliance, notices', 6),
  ('business-finance', 'payroll', 'Payroll Processing', 'சம்பள செயலாக்கம்', 'Salary runs, PF/ESI, compliance', 7),
  ('business-finance', 'audit-assurance', 'Audit & Assurance', 'ஆடிட் & அஷூரன்ஸ்', 'Internal audits, process reviews', 8),
  ('business-finance', 'cfo-services', 'Virtual CFO Services', 'விர்ச்சுவல் CFO சேவைகள்', 'Fractional finance leadership', 9),
  ('business-finance', 'business-valuation', 'Business Valuation', 'வணிக மதிப்பீடு', 'Company worth, equity valuation', 10),
  ('business-finance', 'investment-research', 'Investment Research', 'முதலீட்டு ஆராய்ச்சி', 'Equity analysis, sector reports', 11),
  ('business-finance', 'crypto-accounting', 'Crypto Accounting & Tax', 'கிரிப்டோ கணக்கியல் & வரி', 'On-chain transaction reporting', 12),
  ('business-finance', 'management-consulting', 'Management Consulting', 'மேலாண்மை ஆலோசனை', 'Strategy, growth, org design', 13),
  ('business-finance', 'operations-consulting', 'Operations Consulting', 'செயல்பாட்டு ஆலோசனை', 'SOPs, process mapping, efficiency', 14),
  ('business-finance', 'supply-chain', 'Supply Chain & Logistics', 'சப்ளை செயின் & லாஜிஸ்டிக்ஸ்', 'Sourcing, inventory, distribution', 15),
  ('business-finance', 'procurement', 'Procurement & Vendor Management', 'கொள்முதல் & விற்பனையாளர் மேலாண்மை', 'Sourcing, negotiation, contracts', 16),
  ('business-finance', 'market-research', 'Market Research', 'சந்தை ஆராய்ச்சி', 'TAM, competitor and industry reports', 17),
  ('business-finance', 'business-registration', 'Company Registration & Licenses', 'நிறுவன பதிவு & உரிமங்கள்', 'Incorporation, FSSAI, Udyam, trade license', 18),
  ('business-finance', 'legal-consulting', 'Legal Consulting', 'சட்ட ஆலோசனை', 'Advisory, contracts review, disputes', 19),
  ('business-finance', 'contract-drafting', 'Contract Drafting', 'ஒப்பந்த வரைவு', 'Agreements, NDAs, service contracts', 20),
  ('business-finance', 'paralegal-services', 'Paralegal Services', 'பாரா-லீகல் சேவைகள்', 'Research, filings, documentation', 21),
  ('business-finance', 'ip-trademark-patent', 'Trademark & Patent Filing', 'டிரேட்மார்க் & பேட்டண்ட் தாக்கல்', 'IP search, registration, prosecution', 22),
  ('business-finance', 'compliance-consulting', 'Compliance & Data Privacy', 'இணக்கம் & டேட்டா பிரைவசி', 'GDPR, DPDP, HIPAA, ISO', 23),
  ('business-finance', 'immigration-visa', 'Immigration & Visa Documentation', 'குடியேற்றம் & விசா ஆவணங்கள்', 'Applications, SOPs, paperwork', 24),
  ('business-finance', 'fundraising-consulting', 'Fundraising & Investor Relations', 'நிதி திரட்டல் & முதலீட்டாளர் உறவுகள்', 'Data rooms, investor outreach', 25),
  ('business-finance', 'grant-subsidy-consulting', 'Grants & Government Schemes', 'மானியம் & அரசு திட்டங்கள்', 'Subsidy applications, MSME schemes', 26),
  ('business-finance', 'pricing-strategy', 'Pricing Strategy', 'விலை நிர்ணய உத்தி', 'Packaging, tiers, margin analysis', 27),
  ('business-finance', 'real-estate-consulting', 'Real Estate Consulting', 'ரியல் எஸ்டேட் ஆலோசனை', 'Deal analysis, property advisory', 28),
  ('business-finance', 'insurance-consulting', 'Insurance Advisory', 'காப்பீட்டு ஆலோசனை', 'Policy comparison, claims support', 29),
  ('admin-support', 'virtual-assistant', 'Virtual Assistant', 'விர்ச்சுவல் அசிஸ்டன்ட்', 'Inbox, calendar, general admin tasks', 1),
  ('admin-support', 'executive-assistant', 'Executive Assistant', 'எக்ஸிகியூட்டிவ் அசிஸ்டன்ட்', 'High-level EA and chief-of-staff support', 2),
  ('admin-support', 'customer-support', 'Customer Support', 'வாடிக்கையாளர் ஆதரவு', 'Email and ticket handling', 3),
  ('admin-support', 'live-chat-support', 'Live Chat Support', 'லைவ் சாட் ஆதரவு', 'Real-time website chat', 4),
  ('admin-support', 'technical-support', 'Technical Support', 'தொழில்நுட்ப ஆதரவு', 'Tier 1 and 2 troubleshooting', 5),
  ('admin-support', 'telecalling', 'Telecalling & Call Center', 'டெலிகாலிங் & கால் சென்டர்', 'Inbound and outbound calling', 6),
  ('admin-support', 'appointment-setting', 'Appointment Setting', 'அப்பாயின்ட்மென்ட் செட்டிங்', 'Booking qualified sales meetings', 7),
  ('admin-support', 'cold-calling', 'Cold Calling', 'கோல்ட் காலிங்', 'Outbound prospecting calls', 8),
  ('admin-support', 'lead-generation', 'Lead Generation', 'லீட் ஜெனரேஷன்', 'List building, prospect research', 9),
  ('admin-support', 'sales-closing', 'Sales & Closing', 'விற்பனை & இறுதி செய்தல்', 'Remote sales reps, deal closing', 10),
  ('admin-support', 'crm-management', 'CRM Management', 'CRM மேலாண்மை', 'Pipeline hygiene, automations, reporting', 11),
  ('admin-support', 'order-fulfillment', 'Order & Fulfillment Support', 'ஆர்டர் & ஃபுல்பில்மென்ட் ஆதரவு', 'Processing, tracking, returns', 12),
  ('admin-support', 'project-management', 'Project Management', 'திட்ட மேலாண்மை', 'Scope, timelines, delivery coordination', 13),
  ('admin-support', 'scrum-agile', 'Scrum & Agile Coaching', 'ஸ்க்ரம் & அஜைல் கோச்சிங்', 'Sprints, ceremonies, team process', 14),
  ('admin-support', 'recruitment-sourcing', 'Recruitment & Sourcing', 'ஆட்சேர்ப்பு & சோர்சிங்', 'Candidate pipelines, screening', 15),
  ('admin-support', 'hr-consulting', 'HR Consulting', 'HR ஆலோசனை', 'Policies, handbooks, performance systems', 16),
  ('admin-support', 'training-onboarding', 'Training & Onboarding', 'பயிற்சி & ஆன்போர்டிங்', 'New hire programs, documentation', 17),
  ('admin-support', 'event-coordination', 'Event Coordination', 'நிகழ்ச்சி ஒருங்கிணைப்பு', 'Vendors, timelines, on-ground execution', 18),
  ('admin-support', 'travel-planning', 'Travel Planning', 'பயண திட்டமிடல்', 'Itineraries, bookings, visas', 19),
  ('admin-support', 'notion-airtable-setup', 'Notion & Airtable Setup', 'Notion & Airtable அமைப்பு', 'Workspaces, databases, templates', 20),
  ('admin-support', 'document-formatting', 'Document Formatting', 'ஆவண வடிவமைப்பு', 'Word styles, templates, ebook layout', 21),
  ('admin-support', 'file-organization', 'File & Digital Organization', 'கோப்பு & டிஜிட்டல் ஒழுங்கமைப்பு', 'Drive cleanup, naming systems', 22),
  ('engineering-architecture', 'mechanical-design', 'Mechanical Design', 'மெக்கானிக்கல் வடிவமைப்பு', 'SolidWorks, Fusion 360, part design', 1),
  ('engineering-architecture', 'cad-drafting', 'CAD Drafting', 'CAD வரைவு', '2D AutoCAD drawings, detailing', 2),
  ('engineering-architecture', 'electrical-engineering', 'Electrical Engineering', 'மின் பொறியியல்', 'Schematics, load calculations, panels', 3),
  ('engineering-architecture', 'pcb-design', 'PCB Design', 'PCB வடிவமைப்பு', 'Altium, KiCad, EasyEDA layouts', 4),
  ('engineering-architecture', 'civil-structural', 'Civil & Structural Engineering', 'சிவில் & கட்டமைப்பு பொறியியல்', 'Structural calcs, STAAD, ETABS', 5),
  ('engineering-architecture', 'architecture-plans', 'Architecture & Floor Plans', 'கட்டிடக்கலை & தள வரைபடங்கள்', 'Plans, elevations, permit drawings', 6),
  ('engineering-architecture', '3d-architectural-rendering', '3D Architectural Rendering', '3D கட்டிடக்கலை ரெண்டரிங்', 'Photoreal exteriors and interiors', 7),
  ('engineering-architecture', 'bim-revit', 'BIM & Revit Modeling', 'BIM & Revit மாடலிங்', 'Coordination, clash detection', 8),
  ('engineering-architecture', 'interior-design', 'Interior Design', 'உள்துறை வடிவமைப்பு', 'Layouts, mood boards, material selection', 9),
  ('engineering-architecture', 'landscape-design', 'Landscape Design', 'லேண்ட்ஸ்கேப் வடிவமைப்பு', 'Gardens, outdoor planning', 10),
  ('engineering-architecture', 'mep-hvac', 'MEP & HVAC Design', 'MEP & HVAC வடிவமைப்பு', 'Plumbing, ducting, electrical plans', 11),
  ('engineering-architecture', 'quantity-surveying', 'Quantity Surveying & Estimation', 'அளவு கணிப்பு & மதிப்பீடு', 'BOQ, costing, tender estimates', 12),
  ('engineering-architecture', 'surveying', 'Land Surveying', 'நில அளவீடு', 'Topographic and boundary surveys', 13),
  ('engineering-architecture', 'product-industrial-design', 'Product & Industrial Design', 'தயாரிப்பு & தொழில்துறை வடிவமைப்பு', 'Form, ergonomics, DFM', 14),
  ('engineering-architecture', '3d-modeling-printing', '3D Modeling & Printing', '3D மாடலிங் & பிரிண்டிங்', 'Print-ready models, slicing, services', 15),
  ('engineering-architecture', 'cnc-cam-programming', 'CNC & CAM Programming', 'CNC & CAM புரோகிராமிங்', 'G-code, toolpaths, machining setup', 16),
  ('engineering-architecture', 'simulation-fea-cfd', 'Simulation (FEA / CFD)', 'சிமுலேஷன் (FEA / CFD)', 'Stress, thermal, flow analysis', 17),
  ('engineering-architecture', 'chemical-process', 'Chemical & Process Engineering', 'வேதியியல் & செயல்முறை பொறியியல்', 'P&ID, mass balance, simulations', 18),
  ('engineering-architecture', 'solar-energy-design', 'Solar & Energy Design', 'சோலார் & எனர்ஜி வடிவமைப்பு', 'PV layouts, energy audits', 19),
  ('engineering-architecture', 'acoustics-lighting', 'Acoustics & Lighting Design', 'ஒலியியல் & லைட்டிங் வடிவமைப்பு', 'Room treatment, stage and architectural lighting', 20),
  ('engineering-architecture', 'safety-consulting', 'Fire & Safety Consulting', 'தீ & பாதுகாப்பு ஆலோசனை', 'NOC drawings, safety audits', 21),
  ('engineering-architecture', 'patent-illustration', 'Patent & Technical Illustration', 'பேட்டண்ட் & தொழில்நுட்ப சித்திரம்', 'Drawings for filings and manuals', 22),
  ('education-training', 'academic-tutoring', 'Academic Tutoring', 'கல்வி டியூஷன்', 'School and college subjects', 1),
  ('education-training', 'competitive-exam-coaching', 'Competitive Exam Coaching', 'போட்டித் தேர்வு பயிற்சி', 'JEE, NEET, UPSC, TNPSC, GATE', 2),
  ('education-training', 'language-tutoring', 'Language Tutoring', 'மொழி டியூஷன்', 'English, Tamil, Hindi, foreign languages', 3),
  ('education-training', 'ielts-toefl-prep', 'IELTS / TOEFL / GRE Prep', 'IELTS / TOEFL / GRE தயாரிப்பு', 'Test strategy, speaking and writing practice', 4),
  ('education-training', 'coding-tutoring', 'Coding & Tech Tutoring', 'கோடிங் & டெக் டியூஷன்', 'Programming lessons, project help', 5),
  ('education-training', 'course-creation', 'Online Course Creation', 'ஆன்லைன் கோர்ஸ் உருவாக்கம்', 'Curriculum, recording, production', 6),
  ('education-training', 'instructional-design', 'Instructional Design', 'இன்ஸ்ட்ரக்ஷனல் டிசைன்', 'Learning paths, assessments', 7),
  ('education-training', 'elearning-development', 'E-Learning Development', 'இ-லேர்னிங் டெவலப்மென்ட்', 'Articulate, SCORM, LMS setup', 8),
  ('education-training', 'corporate-training', 'Corporate Training', 'கார்ப்பரேட் பயிற்சி', 'Soft skills, tools, compliance training', 9),
  ('education-training', 'career-coaching', 'Career Coaching', 'கரியர் கோச்சிங்', 'Job strategy, transitions, salary negotiation', 10),
  ('education-training', 'interview-coaching', 'Interview Coaching', 'இன்டர்வியூ கோச்சிங்', 'Mock interviews, feedback', 11),
  ('education-training', 'study-abroad-counseling', 'Study Abroad Counseling', 'வெளிநாட்டுப் படிப்பு ஆலோசனை', 'Applications, SOP, university selection', 12),
  ('education-training', 'life-coaching', 'Life & Productivity Coaching', 'வாழ்க்கை & உற்பத்தித்திறன் கோச்சிங்', 'Goals, habits, focus systems', 13),
  ('education-training', 'business-mentoring', 'Business & Startup Mentoring', 'வணிக & ஸ்டார்ட்அப் வழிகாட்டல்', 'Founder guidance, growth advice', 14),
  ('education-training', 'public-speaking-coaching', 'Public Speaking Coaching', 'பொதுப் பேச்சு கோச்சிங்', 'Presentation and stage skills', 15),
  ('education-training', 'music-art-lessons', 'Music & Art Lessons', 'இசை & கலை பாடங்கள்', 'Instruments, vocals, drawing, painting', 16),
  ('education-training', 'thesis-guidance', 'Thesis & Research Guidance', 'ஆய்வேடு & ஆராய்ச்சி வழிகாட்டல்', 'Methodology, literature review support', 17),
  ('education-training', 'question-bank-creation', 'Question Bank & Test Creation', 'வினாத்தாள் & தேர்வு உருவாக்கம்', 'MCQs, assessments, answer keys', 18),
  ('health-wellness', 'nutrition-diet-plans', 'Nutrition & Diet Plans', 'ஊட்டச்சத்து & உணவுத் திட்டங்கள்', 'Personalized meal and nutrition planning', 1),
  ('health-wellness', 'fitness-coaching', 'Fitness Coaching', 'ஃபிட்னஸ் கோச்சிங்', 'Remote training programs and check-ins', 2),
  ('health-wellness', 'yoga-instruction', 'Yoga Instruction', 'யோகா பயிற்சி', 'Online classes and routines', 3),
  ('health-wellness', 'physiotherapy-consulting', 'Physiotherapy Consulting', 'பிசியோதெரபி ஆலோசனை', 'Exercise protocols, rehab guidance', 4),
  ('health-wellness', 'mental-health-counseling', 'Counseling & Therapy', 'ஆலோசனை & சிகிச்சை', 'Licensed mental health support', 5),
  ('health-wellness', 'meditation-mindfulness', 'Meditation & Mindfulness', 'தியானம் & மைண்ட்ஃபுல்னஸ்', 'Guided sessions, breathwork', 6),
  ('health-wellness', 'sports-performance', 'Sports Performance Analysis', 'விளையாட்டு செயல்திறன் பகுப்பாய்வு', 'Video analysis, training plans', 7),
  ('health-wellness', 'medical-coding-billing', 'Medical Coding & Billing', 'மருத்துவ கோடிங் & பில்லிங்', 'ICD, CPT coding, claims processing', 8),
  ('health-wellness', 'medical-transcription', 'Medical Transcription', 'மருத்துவ டிரான்ஸ்கிரிப்ஷன்', 'Clinical audio to documentation', 9),
  ('health-wellness', 'clinical-research-support', 'Clinical Research Support', 'மருத்துவ ஆராய்ச்சி ஆதரவு', 'Trial coordination, documentation', 10),
  ('health-wellness', 'regulatory-affairs', 'Regulatory Affairs', 'ஒழுங்குமுறை விவகாரங்கள்', 'CDSCO, FDA submissions, dossiers', 11),
  ('health-wellness', 'healthcare-content', 'Healthcare Content', 'சுகாதார உள்ளடக்கம்', 'Patient education, medical blogs', 12),
  ('health-wellness', 'veterinary-pet-consulting', 'Veterinary & Pet Consulting', 'கால்நடை & செல்லப்பிராணி ஆலோசனை', 'Remote pet health and behavior advice', 13),
  ('lifestyle-personal', 'photography', 'Photography', 'புகைப்படக்கலை', 'Portrait, product, event, real estate', 1),
  ('lifestyle-personal', 'wedding-photography', 'Wedding Photography', 'திருமண புகைப்படக்கலை', 'Candid, traditional, albums', 2),
  ('lifestyle-personal', 'food-photography-styling', 'Food Photography & Styling', 'உணவு புகைப்படம் & ஸ்டைலிங்', 'Menu shoots, plating, props', 3),
  ('lifestyle-personal', 'makeup-artist', 'Makeup Artist', 'மேக்கப் கலைஞர்', 'Bridal, event, shoot makeup', 4),
  ('lifestyle-personal', 'hair-styling', 'Hair Styling', 'முடி அலங்காரம்', 'Event and shoot styling', 5),
  ('lifestyle-personal', 'mehendi-art', 'Mehendi & Body Art', 'மெகந்தி & உடல் கலை', 'Bridal and event henna', 6),
  ('lifestyle-personal', 'fashion-styling', 'Fashion Styling', 'ஃபேஷன் ஸ்டைலிங்', 'Wardrobe curation, shoot styling', 7),
  ('lifestyle-personal', 'personal-shopping', 'Personal Shopping', 'தனிப்பட்ட ஷாப்பிங்', 'Sourcing, gifting, wardrobe buying', 8),
  ('lifestyle-personal', 'image-consulting', 'Image Consulting', 'இமேஜ் ஆலோசனை', 'Personal branding, grooming, color analysis', 9),
  ('lifestyle-personal', 'event-planning', 'Event & Wedding Planning', 'நிகழ்ச்சி & திருமண திட்டமிடல்', 'Full event management and vendors', 10),
  ('lifestyle-personal', 'decoration-services', 'Decoration Services', 'அலங்கார சேவைகள்', 'Stage, balloon, floral, home decor', 11),
  ('lifestyle-personal', 'catering-chef', 'Catering & Private Chef', 'கேட்டரிங் & தனியார் சமையல்காரர்', 'Event catering, home cooking services', 12),
  ('lifestyle-personal', 'baking-cakes', 'Baking & Custom Cakes', 'பேக்கிங் & கஸ்டம் கேக்குகள்', 'Celebration cakes, desserts', 13),
  ('lifestyle-personal', 'anchoring-emcee', 'Anchoring & Emcee', 'தொகுப்பாளர் & நிகழ்ச்சி நடத்துனர்', 'Event hosting, compering', 14),
  ('lifestyle-personal', 'dance-choreography', 'Dance & Choreography', 'நடனம் & நடன இயக்கம்', 'Wedding, reels, stage choreography', 15),
  ('lifestyle-personal', 'modeling-acting', 'Modeling & Acting', 'மாடலிங் & நடிப்பு', 'Commercial shoots, self-tapes, extras', 16),
  ('lifestyle-personal', 'astrology-tarot', 'Astrology & Tarot', 'ஜோதிடம் & டாரட்', 'Horoscope, readings, muhurtham', 17),
  ('lifestyle-personal', 'vastu-consulting', 'Vastu & Feng Shui', 'வாஸ்து & ஃபெங் ஷுயி ஆலோசனை', 'Home and office layout consultation', 18),
  ('lifestyle-personal', 'home-organizing', 'Home Organizing & Decluttering', 'வீடு ஒழுங்கமைப்பு & குவியல் அகற்றுதல்', 'Space planning, storage systems', 19),
  ('lifestyle-personal', 'travel-guiding', 'Tour Guiding', 'சுற்றுலா வழிகாட்டுதல்', 'Local tours, virtual tours, trip hosting', 20),
  ('lifestyle-personal', 'pet-services', 'Pet Services', 'செல்லப்பிராணி சேவைகள்', 'Sitting, walking, grooming, training', 21),
  ('lifestyle-personal', 'elderly-childcare', 'Elderly Care & Childcare', 'முதியோர் & குழந்தை பராமரிப்பு', 'Companionship, babysitting, nannies', 22),
  ('lifestyle-personal', 'handyman-repairs', 'Handyman & Repairs', 'ஹேண்டிமேன் & பழுதுபார்ப்பு', 'Electrical, plumbing, carpentry, AC service', 23),
  ('lifestyle-personal', 'cleaning-services', 'Cleaning Services', 'சுத்தம் செய்யும் சேவைகள்', 'Deep cleaning, housekeeping, sanitization', 24),
  ('lifestyle-personal', 'gardening-landscaping', 'Gardening & Landscaping', 'தோட்டக்கலை & லேண்ட்ஸ்கேப்பிங்', 'Maintenance, planting, terrace gardens', 25),
  ('lifestyle-personal', 'driving-delivery', 'Driving & Delivery', 'ஓட்டுநர் & டெலிவரி', 'Drivers, local pickup and drop', 26),
  ('lifestyle-personal', 'packers-movers', 'Packing & Moving Help', 'பேக்கிங் & மூவிங் உதவி', 'Shifting assistance, loading', 27),
  ('lifestyle-personal', 'tailoring-alterations', 'Tailoring & Alterations', 'தையல் & ஆடை மாற்றம்', 'Stitching, fitting, custom garments', 28),
  ('lifestyle-personal', 'printing-services', 'Printing & Fabrication', 'அச்சிடுதல் & ஃபேப்ரிகேஷன் சேவைகள்', 'Flex boards, business cards, merchandise', 29),
  ('gaming-esports', 'game-testing', 'Game Testing & QA', 'கேம் டெஸ்டிங் & QA', 'Bug hunting, compatibility testing', 1),
  ('gaming-esports', 'playtesting-feedback', 'Playtesting & UX Feedback', 'ப்ளேடெஸ்டிங் & UX பின்னூட்டம்', 'Session feedback, balance reports', 2),
  ('gaming-esports', 'esports-coaching', 'Esports Coaching', 'இ-ஸ்போர்ட்ஸ் கோச்சிங்', 'Rank improvement, strategy, VOD review', 3),
  ('gaming-esports', 'game-art-assets', 'Game Art & Assets', 'கேம் ஆர்ட் & அசெட்ஸ்', 'Sprites, props, environments, UI kits', 4),
  ('gaming-esports', 'level-design', 'Level & Map Design', 'லெவல் & மேப் வடிவமைப்பு', 'Layouts, encounters, custom maps', 5),
  ('gaming-esports', 'game-modding', 'Game Modding', 'கேம் மாடிங்', 'Mods for Minecraft, GTA, Skyrim, Roblox', 6),
  ('gaming-esports', 'roblox-minecraft-scripting', 'Roblox & Minecraft Scripting', 'Roblox & Minecraft ஸ்கிரிப்டிங்', 'Lua, plugins, custom servers', 7),
  ('gaming-esports', 'narrative-design', 'Narrative Design', 'கதை வடிவமைப்பு', 'Story, branching dialogue, lore', 8),
  ('gaming-esports', 'game-economy-design', 'Game Economy Design', 'கேம் எகானமி வடிவமைப்பு', 'Balancing, progression, monetization', 9),
  ('gaming-esports', 'tournament-management', 'Tournament Management', 'போட்டி மேலாண்மை', 'Brackets, rules, admin, scheduling', 10),
  ('gaming-esports', 'shoutcasting', 'Shoutcasting & Commentary', 'ஷவுட்காஸ்டிங் & விளக்கம்', 'Live match commentary', 11),
  ('gaming-esports', 'gaming-content-creation', 'Gaming Content Creation', 'கேமிங் உள்ளடக்க உருவாக்கம்', 'Montages, highlights, guide videos', 12),
  ('gaming-esports', 'discord-server-setup', 'Discord Server Setup', 'Discord சேவையக அமைப்பு', 'Roles, bots, moderation, structure', 13),
  ('web3-emerging', 'tokenomics-design', 'Tokenomics Design', 'டோக்கனாமிக்ஸ் வடிவமைப்பு', 'Supply, incentives, distribution models', 1),
  ('web3-emerging', 'whitepaper-writing', 'Whitepaper & Litepaper', 'ஒயிட்பேப்பர் & லைட்பேப்பர் எழுத்து', 'Technical and investor documentation', 2),
  ('web3-emerging', 'nft-collection', 'NFT Collections', 'NFT சேகரிப்புகள்', 'Trait art, generative sets, minting sites', 3),
  ('web3-emerging', 'dao-governance', 'DAO & Governance', 'DAO & நிர்வாகம்', 'Structure, voting, treasury setup', 4),
  ('web3-emerging', 'onchain-analysis', 'On-Chain Analysis', 'ஆன்-செயின் பகுப்பாய்வு', 'Wallet forensics, protocol metrics', 5),
  ('web3-emerging', 'defi-strategy', 'DeFi Strategy', 'DeFi உத்தி', 'Yield, liquidity, risk analysis', 6),
  ('web3-emerging', 'node-validator-setup', 'Node & Validator Setup', 'நோட் & வேலிடேட்டர் அமைப்பு', 'Infrastructure and maintenance', 7),
  ('web3-emerging', 'metaverse-world-building', 'Metaverse World Building', 'மெட்டாவர்ஸ் உலக உருவாக்கம்', 'Virtual spaces, events, experiences', 8),
  ('web3-emerging', 'digital-twin', 'Digital Twin Development', 'டிஜிட்டல் ட்வின் டெவலப்மென்ட்', 'Industrial simulation and modeling', 9),
  ('web3-emerging', 'drone-mapping', 'Drone Mapping & Photogrammetry', 'ட்ரோன் மேப்பிங் & ஃபோட்டோகிராமெட்ரி', 'Survey maps, 3D site models', 10),
  ('web3-emerging', 'satellite-imagery-analysis', 'Satellite Imagery Analysis', 'செயற்கைக்கோள் படப் பகுப்பாய்வு', 'Crop, land use, change detection', 11),
  ('web3-emerging', 'ai-governance-consulting', 'AI Governance & Compliance', 'AI நிர்வாகம் & இணக்கம்', 'Model risk, AI Act readiness', 12),
  ('web3-emerging', 'sustainability-esg', 'Sustainability & ESG', 'நிலைத்தன்மை & ESG', 'Carbon accounting, net-zero reporting', 13),
  ('digital-products', 'notion-templates', 'Notion Templates', 'Notion டெம்ப்ளேட்கள்', 'Ready-to-use workspace systems', 1),
  ('digital-products', 'canva-templates', 'Canva & Design Templates', 'Canva & வடிவமைப்பு டெம்ப்ளேட்கள்', 'Editable social and print templates', 2),
  ('digital-products', 'website-templates', 'Website & Theme Templates', 'வலைத்தள & தீம் டெம்ப்ளேட்கள்', 'HTML, WordPress, Framer themes', 3),
  ('digital-products', 'ui-kits', 'UI Kits & Design Systems', 'UI கிட்ஸ் & வடிவமைப்பு அமைப்புகள்', 'Figma components, style libraries', 4),
  ('digital-products', 'presets-luts', 'Presets & LUTs', 'ப்ரீசெட்கள் & LUTs', 'Lightroom presets, color grading LUTs', 5),
  ('digital-products', 'stock-assets', 'Stock Photos, Video & Vectors', 'ஸ்டாக் புகைப்படங்கள், வீடியோ & வெக்டர்கள்', 'Licensable media assets', 6),
  ('digital-products', 'ebooks-guides', 'Ebooks & Guides', 'இ-புத்தகங்கள் & வழிகாட்டிகள்', 'Digital books, playbooks, checklists', 7),
  ('digital-products', 'spreadsheet-templates', 'Spreadsheet Templates', 'ஸ்பிரெட்ஷீட் டெம்ப்ளேட்கள்', 'Trackers, calculators, dashboards', 8),
  ('digital-products', 'legal-doc-templates', 'Legal Document Templates', 'சட்ட ஆவண டெம்ப்ளேட்கள்', 'Contracts, policies, forms', 9),
  ('digital-products', 'code-scripts-plugins', 'Code, Scripts & Plugins', 'கோட், ஸ்கிரிப்ட் & பிளகின்கள்', 'Boilerplates, WP plugins, Figma plugins', 10),
  ('digital-products', 'prompt-packs', 'Prompt Packs & AI Workflows', 'ப்ராம்ப்ட் பேக்ஸ் & AI ஒர்க்ஃப்ளோக்கள்', 'Curated prompts, agent setups', 11),
  ('digital-products', 'fonts-typefaces', 'Fonts & Typefaces', 'எழுத்துருக்கள்', 'Licensable font families', 12);


-- ---------------------------------------------------------------------------
-- Re-attach jobs/service_packages to the granular subcategory.
-- ---------------------------------------------------------------------------
alter table public.jobs add constraint jobs_category_slug_fkey foreign key (category_slug) references public.subcategories (slug);
alter table public.service_packages add constraint service_packages_category_slug_fkey foreign key (category_slug) references public.subcategories (slug);

-- ---------------------------------------------------------------------------
-- Admin writes: extend the category icon whitelist to the new 16 icons, and add the
-- matching upsert function for subcategories (same audited, admin-only pattern).
-- ---------------------------------------------------------------------------
create or replace function public.admin_upsert_category(
  p_id uuid, p_slug text, p_name_en text, p_name_ta text, p_icon text, p_sort_order integer, p_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.require_admin();
  if p_slug !~ '^[a-z0-9-]{2,40}$' then raise exception 'slug must be 2 to 40 lowercase letters, digits or dashes' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_name_en, ''))) < 2 or char_length(btrim(coalesce(p_name_ta, ''))) < 2 then
    raise exception 'both names are required' using errcode = '22023';
  end if;
  if p_icon not in ('pen-line', 'palette', 'video', 'music', 'code', 'brain', 'megaphone', 'briefcase', 'headset', 'ruler', 'graduation-cap', 'heart-pulse', 'sparkles', 'gamepad-2', 'boxes', 'package') then
    raise exception 'unknown icon' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.categories (slug, name_en, name_ta, icon, sort_order, is_active)
    values (p_slug, btrim(p_name_en), btrim(p_name_ta), p_icon, coalesce(p_sort_order, 0), coalesce(p_active, true))
    returning id into v_id;
  else
    update public.categories
       set slug = p_slug, name_en = btrim(p_name_en), name_ta = btrim(p_name_ta), icon = p_icon,
           sort_order = coalesce(p_sort_order, 0), is_active = coalesce(p_active, true)
     where id = p_id
     returning id into v_id;
    if v_id is null then raise exception 'category not found' using errcode = 'P0002'; end if;
  end if;
  perform public.log_admin_action(case when p_id is null then 'add_category' else 'edit_category' end, 'category', v_id::text,
                                  jsonb_build_object('slug', p_slug, 'active', coalesce(p_active, true)));
  return v_id;
end;
$$;

create function public.admin_upsert_subcategory(
  p_id uuid, p_category_slug text, p_slug text, p_name_en text, p_name_ta text, p_description_en text,
  p_sort_order integer, p_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.require_admin();
  if p_slug !~ '^[a-z0-9-]{2,60}$' then raise exception 'slug must be 2 to 60 lowercase letters, digits or dashes' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_name_en, ''))) < 2 or char_length(btrim(coalesce(p_name_ta, ''))) < 2 then
    raise exception 'both names are required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.categories where slug = p_category_slug) then
    raise exception 'unknown category' using errcode = '23503';
  end if;

  if p_id is null then
    insert into public.subcategories (category_slug, slug, name_en, name_ta, description_en, sort_order, is_active)
    values (p_category_slug, p_slug, btrim(p_name_en), btrim(p_name_ta), coalesce(btrim(p_description_en), ''), coalesce(p_sort_order, 0), coalesce(p_active, true))
    returning id into v_id;
  else
    update public.subcategories
       set category_slug = p_category_slug, slug = p_slug, name_en = btrim(p_name_en), name_ta = btrim(p_name_ta),
           description_en = coalesce(btrim(p_description_en), ''), sort_order = coalesce(p_sort_order, 0), is_active = coalesce(p_active, true)
     where id = p_id
     returning id into v_id;
    if v_id is null then raise exception 'subcategory not found' using errcode = 'P0002'; end if;
  end if;
  perform public.log_admin_action(case when p_id is null then 'add_subcategory' else 'edit_subcategory' end, 'subcategory', v_id::text,
                                  jsonb_build_object('slug', p_slug, 'category_slug', p_category_slug, 'active', coalesce(p_active, true)));
  return v_id;
end;
$$;

revoke all on function public.admin_upsert_subcategory(uuid, text, text, text, text, text, integer, boolean) from public, anon, authenticated;
grant execute on function public.admin_upsert_subcategory(uuid, text, text, text, text, text, integer, boolean) to authenticated;
