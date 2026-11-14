KPL/MK

Meta-noyau de référence (utile pour d'autres outils SPICE).
Le pipeline Python charge les fichiers directement, sans passer par ce fichier.
Lancez les outils SPICE depuis le dossier pipeline/kernels/.

\begindata

  KERNELS_TO_LOAD = ( 'naif0012.tls'
                      'pck00011.tpc'
                      'moon_de440_250416.tf'
                      'moon_pa_de440_200625.bpc'
                      'de440s.bsp' )

\begintext
