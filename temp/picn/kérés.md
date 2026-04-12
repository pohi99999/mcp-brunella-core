<!DOCTYPE html>

<html lang="hu">

<head>

<meta charset="UTF-8">

<meta name="viewport" content="width=device-width, initial-scale=1.0">



<!-- Google Fonts -->

<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400\&family=Playfair+Display:wght@300;400\&display=swap" rel="stylesheet">



<style>

body {

&#x20; margin: 0;

&#x20; background: linear-gradient(180deg, #1A0B0B 0%, #3A0F0F 100%);

&#x20; font-family: 'Inter', sans-serif;

&#x20; color: #EDEDED;

}



/\* CONTAINER \*/

.lumen-container {

&#x20; max-width: 720px;

&#x20; margin: 0 auto;

&#x20; padding: 120px 24px;

&#x20; text-align: center;

}



/\* LOGO \*/

.lumen-logo {

&#x20; font-family: 'Playfair Display', serif;

&#x20; font-size: 18px;

&#x20; letter-spacing: 0.25em;

&#x20; color: #C8A96A;

&#x20; margin-bottom: 32px;

}



/\* HERO \*/

.lumen-hero {

&#x20; font-family: 'Playfair Display', serif;

&#x20; font-size: 64px;

&#x20; font-weight: 300;

&#x20; line-height: 1.15;

&#x20; letter-spacing: 0.02em;

&#x20; margin-bottom: 32px;

}



/\* BODY TEXT \*/

.lumen-body {

&#x20; font-size: 17px;

&#x20; line-height: 1.7;

&#x20; color: #CFCFCF;

&#x20; max-width: 520px;

&#x20; margin: 0 auto 56px;

}



/\* DIVIDER \*/

.lumen-divider {

&#x20; width: 60px;

&#x20; height: 1px;

&#x20; background: rgba(200,169,106,0.3);

&#x20; margin: 40px auto;

}



/\* QUOTE \*/

.lumen-quote {

&#x20; font-family: 'Playfair Display', serif;

&#x20; font-size: 28px;

&#x20; font-weight: 300;

&#x20; line-height: 1.5;

&#x20; margin-bottom: 16px;

}



/\* SUB QUOTE \*/

.lumen-subquote {

&#x20; font-size: 15px;

&#x20; font-style: italic;

&#x20; color: #CFCFCF;

&#x20; margin-bottom: 48px;

}



/\* SECOND TEXT \*/

.lumen-secondary {

&#x20; font-family: 'Playfair Display', serif;

&#x20; font-size: 24px;

&#x20; line-height: 1.5;

&#x20; margin-bottom: 64px;

}



/\* LABEL \*/

.lumen-label {

&#x20; font-size: 12px;

&#x20; letter-spacing: 0.2em;

&#x20; text-transform: uppercase;

&#x20; color: #C8A96A;

&#x20; margin-bottom: 16px;

}



/\* NUMBER \*/

.lumen-number {

&#x20; font-family: 'Playfair Display', serif;

&#x20; font-size: 96px;

&#x20; font-weight: 300;

&#x20; letter-spacing: 0.04em;

&#x20; color: #C8A96A;

&#x20; line-height: 1;

}



/\* PALACK \*/

.lumen-unit {

&#x20; font-size: 18px;

&#x20; color: #C8A96A;

&#x20; margin-top: 8px;

&#x20; margin-bottom: 40px;

}



/\* FINAL TEXT \*/

.lumen-final {

&#x20; font-family: 'Playfair Display', serif;

&#x20; font-size: 20px;

&#x20; font-style: italic;

&#x20; line-height: 1.6;

}

</style>



</head>



<body>



<div class="lumen-container">



&#x20; <div class="lumen-logo">LUMEN</div>



&#x20; <div class="lumen-hero">

&#x20;   Nem minden kerül a világ elé.

&#x20; </div>



&#x20; <div class="lumen-body">

&#x20;   A Lumen egy limitált, sorszámozott gyűjtői borkollekció — azok számára, akik értik a ritkaság valódi jelentését.

&#x20; </div>



&#x20; <div class="lumen-divider"></div>



&#x20; <div class="lumen-quote">

&#x20;   Vannak dolgok, amelyek nem sietnek.

&#x20; </div>



&#x20; <div class="lumen-subquote">

&#x20;   Idő kell hozzájuk. Figyelem. Csend.

&#x20; </div>



&#x20; <div class="lumen-secondary">

&#x20;   A Lumen nem a pillanatnak készül — hanem azoknak, akik észreveszik a pillanat értékét.

&#x20; </div>



&#x20; <div class="lumen-label">

&#x20;   Korlátozott elérés

&#x20; </div>



&#x20; <div class="lumen-number">

&#x20;   1500

&#x20; </div>



&#x20; <div class="lumen-unit">

&#x20;   palack

&#x20; </div>



&#x20; <div class="lumen-final">

&#x20;   Nem mindenhol jelenik meg.<br>

&#x20;   És nem marad sokáig.

&#x20; </div>



</div>



</body>

</html>



==================================









LUMEN – JOBB OLDALI DESIGN (FEJLESZTŐI SPEC)















1\. ALAP STRUKTÚRA











layout: centered, single column

max-width: 720px

align: center

padding:

top: 120px

bottom: 120px

left/right: 24px



background:





background: linear-gradient(180deg, #1A0B0B 0%, #3A0F0F 100%);











2\. BETŰTÍPUSOK







font-family:



\- Headings: 'Playfair Display', serif;



\- Body: 'Inter', sans-serif;







3\. SZÍNEK







\--text-main: #EDEDED;



\--text-soft: #CFCFCF;



\--gold: #C8A96A;



\--line: rgba(200,169,106,0.3);







4\. BLOKKONKÉNTI FELÉPÍTÉS







LOGO / LUMEN FELIRAT









font-family: Playfair Display;



font-size: 18px;



letter-spacing: 0.25em;



color: #C8A96A;



margin-bottom: 32px;







HERO CÍM











„Nem minden kerül a világ elé.”





font-family: Playfair Display;



font-size: 64px;



font-weight: 300;



line-height: 1.15;



letter-spacing: 0.02em;



color: #EDEDED;



margin-bottom: 32px;







⸻







&#x20;LEÍRÁS







font-family: Inter;



font-size: 17px;



line-height: 1.7;



color: #CFCFCF;



margin-bottom: 56px;



max-width: 520px;



margin-left: auto;



margin-right: auto;







ELVÁLASZTÓ VONAL







width: 60px;



height: 1px;



background-color: rgba(200,169,106,0.3);



margin: 40px auto;







KÖZÉPSŐ IDÉZET BLOKK







font-family: Playfair Display;



font-size: 28px;



font-weight: 300;



line-height: 1.5;



color: #EDEDED;



margin-bottom: 16px;







AL-IDÉZET







font-family: Inter;



font-size: 15px;



font-style: italic;



color: #CFCFCF;





margin-bottom: 48px;











MÁSODIK SZÖVEG







font-family: Playfair Display;



font-size: 24px;



line-height: 1.5;



color: #EDEDED;





margin-bottom: 64px;







KORLÁTOZOTT ELÉRÉS (LABEL)







font-family: Inter;



font-size: 12px;



letter-spacing: 0.2em;



text-transform: uppercase;



color: #C8A96A;





margin-bottom: 16px;











1500 PALACK (FŐ ELEM)







font-family: Playfair Display;



font-size: 96px;



font-weight: 300;



letter-spacing: 0.04em;



color: #C8A96A;





line-height: 1;











palack” szó







font-family: Inter;



font-size: 18px;



color: #C8A96A;



margin-top: 8px;





margin-bottom: 40px;







ZÁRÓ MONDAT







font-family: Playfair Display;



font-size: 20px;



font-style: italic;



color: #EDEDED;





line-height: 1.6;











EXTRA (AMI A PRÉMIUM ÉRZETET ADJA)







Hover / animáció:





transition: all 0.4s ease;







enyhe fade-in scrollnál

semmi agresszív animáció





Szöveg max szélesség:







NE legyen full width





max-width: 520px;





Nem UI-t szeretnénk, hanem luxury editorial tipográfiát. Nagy whitespace, vékony serif címek, arany kiemelések, lassú olvashatóság. Ne zsúfold kérlek . 

