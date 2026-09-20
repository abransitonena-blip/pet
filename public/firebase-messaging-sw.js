// Archivo heredado que se conserva para no romper una ruta pública que algún
// navegador pudo haber registrado antes. No importa nada y no registra ningún
// manejador: los avisos de PET Ap los atiende /sw.js, que es el worker que la
// app registra y el que recibe el evento `push`.
