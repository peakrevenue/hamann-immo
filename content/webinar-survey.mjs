export const surveyQuestions = [
  {key:'situation',title:'Wo stehst du gerade beim Investieren?',hint:'Wähle die Antwort, die am besten zu dir passt.',options:[['starting','Ich stehe noch am Anfang.'],['securities','Ich investiere bereits in ETFs oder Aktien.'],['first-property','Ich suche meine erste vermietete Immobilie.'],['property-owner','Ich besitze bereits eine vermietete Immobilie.']]},
  {key:'role',title:'Was machst du beruflich?',hint:'So können wir die Beispiele im Webinar besser einordnen.',options:[['employed','Angestellt'],['civil-servant','Verbeamtet'],['self-employed','Selbstständig oder freiberuflich'],['entrepreneur','Unternehmer/in'],['other','Aktuell etwas anderes']]},
  {key:'income',title:'Wie hoch ist dein monatliches Nettoeinkommen?',hint:'Eine grobe Einordnung reicht uns.',options:[['under3500','Unter 3.500 €'],['3500to5000','3.500 bis unter 5.000 €'],['5000to7500','5.000 bis unter 7.500 €'],['over7500','7.500 € oder mehr'],['undisclosed','Möchte ich nicht angeben']]},
  {key:'goals',title:'Was möchtest du mit deinen Investments erreichen?',hint:'Du kannst mehrere Ziele auswählen.',multiple:true,options:[['wealth','Langfristig Vermögen aufbauen'],['retirement','Für meine Rente vorsorgen'],['income','Ein zusätzliches Einkommen aufbauen'],['tax','Mögliche Steuervorteile nutzen'],['first-purchase','Meine erste vermietete Wohnung kaufen'],['understand','Erst einmal verstehen, was für mich passt']]},
  {key:'question',title:'Welche Frage soll im Webinar auf jeden Fall vorkommen?',hint:'Zum Beispiel: Wie viel Eigenkapital brauche ich? Was passiert bei Mietausfall? Dieses Feld ist freiwillig.',text:true},
];

export function surveyAnswerLabels(answers) {
  return surveyQuestions.map(q=>({frage:q.title,antwort:q.text?answers[q.key]||'Keine Frage eingetragen':q.multiple?answers[q.key].map(code=>q.options.find(([value])=>value===code)[1]):q.options.find(([value])=>value===answers[q.key])[1]}));
}
