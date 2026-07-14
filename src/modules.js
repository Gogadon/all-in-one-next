import{COLORS}from'./config.js';
export const MODULES=[
{id:'strength',label:'Kraft',icon:'🏋️',color:COLORS.strength,type:'strength',singular:'Training',plural:'Trainings'},
{id:'cycling',label:'Rad',icon:'🚴',color:COLORS.cycling,type:'tour',singular:'Radtour',plural:'Radtouren',durationMode:'minutes-seconds',metrics:['duration','distance','averageSpeed','elevation','calories','averageHeartRate','maxSpeed','maxHeartRate','averagePower','cadence'],defaultMetrics:['duration','distance','averageSpeed','elevation','calories','averageHeartRate'],optionalMetrics:['maxSpeed','maxHeartRate','averagePower','cadence'],listMetrics:['distance','duration'],share:{eyebrow:'RAD · TOUR',hero:'distance',heroLabel:'STRECKE',filename:'all-in-one-tour'}},
{id:'hiking',label:'Wandern',icon:'🥾',color:COLORS.hiking,type:'tour',singular:'Wanderung',plural:'Wanderungen',durationMode:'hours-minutes',metrics:['duration','distance','elevation','steps','calories','averageHeartRate','maxHeartRate'],defaultMetrics:['duration','distance','elevation','steps','calories','averageHeartRate'],optionalMetrics:['maxHeartRate'],listMetrics:['distance','elevation'],share:{eyebrow:'WANDERN · TOUR',hero:'distance',heroLabel:'STRECKE',filename:'all-in-one-wanderung'}},
{id:'challenge',label:'Ziele',icon:'🎯',color:COLORS.challenge,type:'challenge'}
];
export const getModule=id=>MODULES.find(m=>m.id===id)||null;
