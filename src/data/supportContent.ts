export const USER_GUIDE = `GETTING STARTED
Connect your socket sensor from the Today tab or Settings → Data Source. AVA Fit falls back to simulated data automatically if no device is found, so you can explore the app before hardware is connected.

READING YOUR FIT SCORE
The ring on the Today tab summarizes all 18 sensors into one score. Comfortable is green, Watch means one spot is trending high, Ease Off means take weight off soon.

THE FIT TAB
Shows the live 18-sensor grid and a 3D view of your socket colored by pressure. Tap and drag to rotate, pinch to zoom.

ZERO / TARE
Before a wear session, use Settings → Calibration → Zero/Tare to capture your current readings as the baseline. Re-zero after adding or removing a sock ply.

SESSIONS
Start a session from Today to record pressure data over time. Review or export any session from the Log tab.

TRENDS
The Trends tab tracks wear time and comfort score over the past week so you and your clinician can spot patterns.

CARE TEAM
Add your clinician's contact info and next appointment from the Care tab so they're always one tap away.`;

export const PRIVACY_POLICY = `WHAT AVA FIT STORES
Your profile, calibration settings, and session recordings are stored locally on your device. Socket pressure data from your sensor is processed on-device and is never sent anywhere unless you enable Cloud Sync.

CLOUD SYNC (OPTIONAL)
If you create an account, your profile and session summaries sync to our Supabase-backed cloud so you can access them across devices. Every table is scoped to your account — only you (and, in the future, clinicians you explicitly share with) can read your data.

BLUETOOTH
AVA Fit connects to your prosthetic socket sensor over Bluetooth Low Energy. Pressure and motion data from the sensor stays on-device unless Cloud Sync is enabled.

WHAT WE DON'T DO
We don't sell your data, show ads, or share your information with third parties.

CONTACT
Questions about your data can be directed to your care team through the Care tab.`;
