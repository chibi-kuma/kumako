# Kumako

Petit jeu de classement de livres conçu pour être calme, lisible et jouable au doigt sur iPhone en paysage.

## Jouer localement

Comme les fichiers JavaScript utilisent des modules, lance un petit serveur web dans ce dossier puis ouvre l’adresse indiquée dans un navigateur.

```bash
python3 -m http.server 4173
```

## Principes respectés

- 30 niveaux tous accessibles, de 3 couleurs / 5 emplacements à 6 couleurs / 8 emplacements.
- 7 livres par couleur, numérotés de 1 à 6 ; le livre 0 n’affiche aucun numéro.
- Déplacement du groupe consécutif placé au sommet d’une pile.
- Destination vide, ou livre plus grand de la même couleur.
- Annuler, recommencer et indice unique.
- Aucun son, chrono, classement, étoile, monnaie ou mécanisme de déblocage.
