import {createHash} from 'node:crypto';
import {surveyQuestions,surveyAnswerLabels} from '../content/webinar-survey.mjs';
import {workshop} from '../content/workshop.mjs';

export function contactEmail(value) {
  if(typeof value!=='string')return null;
  const email=value.trim().toLowerCase();
  return email.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)?email:null;
}
export function validateSurvey(data) {
  const email=contactEmail(data.email);
  if(!email)return {error:'Bitte prüfe deine E-Mail-Adresse.'};
  const answers={};
  for(const q of surveyQuestions){
    const answer=data[q.key];
    if(q.text){if(typeof answer!=='string'||answer.length>2000)return {error:'Deine Frage darf höchstens 2.000 Zeichen lang sein.'};answers[q.key]=answer.trim();}
    else if(q.multiple){if(!Array.isArray(answer)||!answer.length||answer.length>q.options.length||!answer.every(code=>q.options.some(([v])=>v===code)))return {error:'Bitte wähle mindestens ein Ziel aus.'};answers[q.key]=q.options.filter(([v])=>answer.includes(v)).map(([v])=>v);}
    else {if(!q.options.some(([v])=>v===answer))return {error:'Bitte beantworte alle Auswahlfragen.'};answers[q.key]=answer;}
  }
  return {value:{email,...answers}};
}
export function surveyPayload(survey,utms) {
  const answers=surveyAnswerLabels(survey.answers);
  return {event:'webinar_survey_completed',event_id:survey.id+':webinar_survey_completed:'+survey.revision,lead_id:survey.id,registration_id:survey.registrationId||null,
    webinar_id:workshop.id,webinar_title:workshop.name,webinar_start:workshop.start,
    email:survey.email,first_name:survey.firstName||'',situation:answers[0].antwort,role:answers[1].antwort,income:answers[2].antwort,goals:answers[3].antwort,webinar_question:answers[4].antwort,
    situation_code:survey.answers.situation,role_code:survey.answers.role,income_code:survey.answers.income,goal_codes:survey.answers.goals,
    antworten:answers,created_at:survey.createdAt,consent_version:'webinar-survey-submit-2026-09-21',attribution:utms,...utms};
}
export const surveyRevision = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,20);
