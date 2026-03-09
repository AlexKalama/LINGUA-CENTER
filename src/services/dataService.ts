import {Student,Teacher,Course,Enrollment,User,Program,Payment,Attendance,GradeRecord,StudentInsight,Certificate,AppNotification,TeacherAttendance} from '../types';
import {supabase} from '../lib/supabase';
const M=6;
const months=(n:number)=>Array.from({length:n},(_,i)=>{const d=new Date(new Date().getFullYear(),new Date().getMonth()-(n-1-i),1);return{key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,label:d.toLocaleString('en-US',{month:'short'})}});
const overall=(g:any[])=>{const r=g.reduce((a,b)=>{const m=+b.maxScore||0,w=+b.weight||0,s=+b.score||0;if(m<=0||w<=0)return a;return{ws:a.ws+(s/m)*w,tw:a.tw+w}},{ws:0,tw:0});return r.tw?Math.round((r.ws/r.tw)*100):0};
class DataService{
  private async invokeEdgeFunction(functionName:string, body:any, fallbackMessage:string){
    const userCheck=await supabase.auth.getUser();
    if(userCheck.error||!userCheck.data.user){
      const refreshed=await supabase.auth.refreshSession();
      if(refreshed.error||!refreshed.data.session)throw new Error('Session expired. Please sign in again.');
      const checkedAgain=await supabase.auth.getUser();
      if(checkedAgain.error||!checkedAgain.data.user)throw new Error('You are not signed in. Please sign out and sign in again as admin.');
    }

    const sessionRes=await supabase.auth.getSession();
    if(sessionRes.error)throw sessionRes.error;
    const token=sessionRes.data.session?.access_token;
    if(!token)throw new Error('No active access token found. Please sign in again.');

    const projectUrl=(import.meta as any).env?.VITE_SUPABASE_URL as string;
    const anonKey=(import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string;
    if(!projectUrl||!anonKey)throw new Error('Supabase env variables are missing.');
    const fnBase=projectUrl.replace('https://','').replace('.supabase.co','');
    const endpoint=`https://${fnBase}.functions.supabase.co/${functionName}`;

    const response=await fetch(endpoint,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        apikey:anonKey,
        Authorization:`Bearer ${token}`
      },
      body:JSON.stringify(body)
    });

    const payload=await response.json().catch(()=>({}));
    if(!response.ok){
      throw new Error(String(payload?.error||payload?.message||`${fallbackMessage} (${response.status}).`));
    }
    return payload;
  }
  private async invokeAdminTeacherAuth(body:any){
    return await this.invokeEdgeFunction('admin-teacher-auth',body,'Teacher auth action failed');
  }
  private async gradSnap(id:string){const {data:e,error:ee}=await supabase.from('enrollments').select('id,status,total_fee').eq('id',id).single();if(ee||!e)throw ee||new Error('Enrollment not found.');const [p,g]=await Promise.all([supabase.from('payments').select('amount').eq('enrollment_id',id),supabase.from('grades').select('assessment_type').eq('enrollment_id',id)]);if(p.error)throw p.error;if(g.error)throw g.error;const paid=(p.data||[]).reduce((s:any,r:any)=>s+(+r.amount||0),0),fee=+e.total_fee||0,b=Math.max(fee-paid,0),t=(g.data||[]).map((r:any)=>String(r.assessment_type||'').toUpperCase());return{status:e.status,balance:b,hasExam:t.includes('EXAM'),hasAssessment:t.some((x:string)=>x!=='EXAM')}}
  private gradReasons(s:any){const r=[] as string[];if(s.status==='GRADUATED')r.push('Already graduated.');if(s.status==='DROPOUT')r.push('Enrollment is marked as dropout.');if(s.balance>0)r.push('Outstanding fee balance must be zero.');if(!s.hasAssessment)r.push('At least one assessment grade is required.');if(!s.hasExam)r.push('At least one exam grade is required.');return r;}
  async markEnrollmentAsGraduated(id:string){const s=await this.gradSnap(id),r=this.gradReasons(s);if(r.length)throw new Error(`Cannot graduate enrollment: ${r.join(' ')}`);const {error}=await supabase.from('enrollments').update({status:'GRADUATED',payment_status:'PAID',fee_balance:0}).eq('id',id);if(error)throw error;}
  async autoGraduateEligibleEnrollments(){const {data,error}=await supabase.from('enrollments').select('id').eq('status','ACTIVE');if(error)throw error;const ids=(data||[]).map((x:any)=>x.id as string);if(!ids.length)return{graduatedCount:0,reviewedCount:0};const ok=[] as string[];for(const id of ids){const s=await this.gradSnap(id);if(this.gradReasons(s).length===0)ok.push(id);}if(ok.length){const {error:e}=await supabase.from('enrollments').update({status:'GRADUATED',payment_status:'PAID',fee_balance:0}).in('id',ok);if(e)throw e;}return{graduatedCount:ok.length,reviewedCount:ids.length};}
  async getPrograms(){const {data,error}=await supabase.from('programs').select('*').order('label');if(error)throw error;return (data||[]).map((p:any)=>({id:p.id,label:p.label,iconName:p.icon_name,color:p.color,defaultLevels:p.default_levels||[]})) as Program[];}
  async addProgram(p:any){const id=p.label.toUpperCase().replace(/\s+/g,'_');const a:any={id,label:p.label,icon_name:p.iconName,color:p.color};if(p.defaultLevels?.length)a.default_levels=p.defaultLevels;let {data,error}=await supabase.from('programs').insert([a]).select().single();if(error&&a.default_levels){delete a.default_levels;const r=await supabase.from('programs').insert([a]).select().single();data=r.data;error=r.error;}if(error)throw error;return{id:data.id,label:data.label,iconName:data.icon_name,color:data.color,defaultLevels:data.default_levels||[]} as Program;}
  async updateProgram(id:string,d:any){const a:any={};if(d.label!==undefined)a.label=d.label;if(d.iconName!==undefined)a.icon_name=d.iconName;if(d.color!==undefined)a.color=d.color;if(d.defaultLevels!==undefined)a.default_levels=d.defaultLevels;let {data,error}=await supabase.from('programs').update(a).eq('id',id).select().single();if(error&&Object.prototype.hasOwnProperty.call(a,'default_levels')){delete a.default_levels;const r=await supabase.from('programs').update(a).eq('id',id).select().single();data=r.data;error=r.error;}if(error)throw error;return{id:data.id,label:data.label,iconName:data.icon_name,color:data.color,defaultLevels:data.default_levels||[]} as Program;}
  async deleteProgram(id:string){const {error}=await supabase.from('programs').delete().eq('id',id);if(error)throw error;}
  async getCourses(){const {data,error}=await supabase.from('courses').select('*');if(error)throw error;return (data||[]).map((c:any)=>({id:c.id,name:c.name,programType:c.program_type,levels:c.levels,levelFees:c.level_fees,active:c.active})) as Course[];}
  async addCourse(c:any){const {data,error}=await supabase.from('courses').insert([{name:c.name,program_type:c.programType,levels:c.levels,level_fees:c.levelFees,active:c.active}]).select().single();if(error)throw error;return{id:data.id,name:data.name,programType:data.program_type,levels:data.levels,levelFees:data.level_fees,active:data.active} as Course;}
  async updateCourse(id:string,d:any){const a:any={...d};if(d.programType!==undefined){a.program_type=d.programType;delete a.programType;}if(d.levelFees!==undefined){a.level_fees=d.levelFees;delete a.levelFees;}const {data,error}=await supabase.from('courses').update(a).eq('id',id).select().single();if(error)throw error;return{id:data.id,name:data.name,programType:data.program_type,levels:data.levels,levelFees:data.level_fees,active:data.active} as Course;}
  async deleteCourse(id:string){const {error}=await supabase.from('courses').delete().eq('id',id);if(error)throw error;}
  async getTeachers(){
    const {data,error}=await supabase.from('teachers').select('*');
    if(error)throw error;
    const t=data||[];
    const ids=t.map((x:any)=>x.id).filter(Boolean);
    const activeEnrollmentsByTeacher=new Map<string,any[]>();
    if(ids.length){
      const {data:r,error:re}=await supabase
        .from('enrollments')
        .select('teacher_id,student_id,course_name,level,status')
        .in('teacher_id',ids);
      if(re)throw re;
      (r||[]).forEach((x:any)=>{
        const teacherId=String(x.teacher_id||'');
        if(!teacherId)return;
        const list=activeEnrollmentsByTeacher.get(teacherId)||[];
        list.push(x);
        activeEnrollmentsByTeacher.set(teacherId,list);
      });
    }
    return t.map((x:any)=>{
      const rows=(activeEnrollmentsByTeacher.get(x.id)||[]).filter((r:any)=>String(r.status||'')==='ACTIVE');
      const activeStudentIds=new Set(rows.map((r:any)=>String(r.student_id||'')).filter(Boolean));
      const activeClassNames=new Set(rows.map((r:any)=>`${String(r.course_name||'').trim()} ${String(r.level||'').trim()}`.trim()).filter(Boolean));
      const mergedCourses=Array.from(new Set([...(Array.isArray(x.courses)?x.courses:[]),...Array.from(activeClassNames)]));
      return{
        ...x,
        idNumber:x.id_number,
        courses:mergedCourses,
        stats:{
          totalStudents:activeStudentIds.size,
          graduates:0,
          dropouts:0,
          activeClasses:activeClassNames.size
        }
      };
    }) as Teacher[];
  }
  async addTeacher(t:any){const {data,error}=await supabase.from('teachers').insert([{name:t.name,email:t.email,phone:t.phone,id_number:t.idNumber,courses:t.courses,active:t.active}]).select().single();if(error)throw error;return{...data,idNumber:data.id_number} as Teacher;}
  async updateTeacher(id:string,d:any){const a:any={...d};if(d.idNumber!==undefined){a.id_number=d.idNumber;delete a.idNumber;}const {data,error}=await supabase.from('teachers').update(a).eq('id',id).select().single();if(error)throw error;return{...data,idNumber:data.id_number} as Teacher;}
  async deleteTeacher(id:string){const {error}=await supabase.from('teachers').delete().eq('id',id);if(error)throw error;}
  async getStudents(user?:User){
    const {data,error}=await supabase.from('students').select('*, enrollments (*)');
    if(error)throw error;
    const s=(data||[]).map((x:any)=>{
      let e=(x.enrollments||[]).map((r:any)=>({
        id:r.id,
        studentId:r.student_id,
        programType:r.program_type,
        courseId:r.course_id,
        courseName:r.course_name,
        level:r.level,
        teacherId:r.teacher_id,
        teacherName:r.teacher_name,
        status:r.status,
        feeBalance:+r.fee_balance||0,
        totalFee:+r.total_fee||0,
        enrollmentDate:r.enrollment_date,
        paymentStatus:r.payment_status,
        payments:[],
        feeItems:[],
        attendance:[]
      })) as Enrollment[];
      if(user?.role==='TEACHER'){
        const tid=user.teacherId||'';
        e=tid?e.filter((y:any)=>y.teacherId===tid):[];
      }
      return{id:x.id,name:x.name,email:x.email,phone:x.phone,identification:x.identification,nextOfKin:x.next_of_kin,enrollments:e} as Student;
    });
    return s.filter((x:any)=>x.enrollments.length>0||!user||user.role==='ADMIN');
  }
  async getStudentById(id:string,user?:User){
    const {data:x,error}=await supabase
      .from('students')
      .select('*, enrollments (*, payments (*, payment_allocations (*)), attendance (*), enrollment_fee_items (*))')
      .eq('id',id)
      .single();
    if(error||!x)return undefined;
    let e=(x.enrollments||[]).map((r:any)=>({
      id:r.id,
      studentId:r.student_id,
      programType:r.program_type,
      courseId:r.course_id,
      courseName:r.course_name,
      level:r.level,
      teacherId:r.teacher_id,
      teacherName:r.teacher_name,
      status:r.status,
      feeBalance:+r.fee_balance||0,
      totalFee:+r.total_fee||0,
      enrollmentDate:r.enrollment_date,
      paymentStatus:r.payment_status,
      payments:(r.payments||[]).map((p:any)=>({
        id:p.id,
        enrollmentId:p.enrollment_id,
        amount:+p.amount||0,
        date:p.date,
        reference:p.reference,
        method:p.method,
        allocations:(p.payment_allocations||[]).map((a:any)=>({
          id:a.id,
          paymentId:a.payment_id,
          enrollmentId:a.enrollment_id,
          enrollmentFeeItemId:a.enrollment_fee_item_id,
          amount:+a.amount||0
        }))
      })),
      feeItems:(r.enrollment_fee_items||[])
        .map((i:any)=>({
          id:i.id,
          enrollmentId:i.enrollment_id,
          category:i.category,
          code:i.code,
          label:i.label,
          amount:+i.amount||0,
          sortOrder:+i.sort_order||0,
          amountPaid:+i.amount_paid||0,
          balance:+i.balance||0,
          status:i.status,
          meta:i.meta||{}
        }))
        .sort((a:any,b:any)=>a.sortOrder-b.sortOrder),
      attendance:(r.attendance||[]).map((a:any)=>({
        id:a.id,
        enrollmentId:a.enrollment_id,
        date:a.date,
        status:a.status
      }))
    })) as Enrollment[];
    if(user?.role==='TEACHER'){
      const tid=user.teacherId||'';
      e=tid?e.filter((y:any)=>y.teacherId===tid):[];
      if(!e.length)return undefined;
    }
    return{id:x.id,name:x.name,email:x.email,phone:x.phone,identification:x.identification,nextOfKin:x.next_of_kin,enrollments:e} as Student;
  }
  async addStudent(s:any){const {data,error}=await supabase.from('students').insert([{name:s.name,email:s.email,phone:s.phone,identification:s.identification,next_of_kin:s.nextOfKin}]).select().single();if(error)throw error;return{...data,nextOfKin:data.next_of_kin,enrollments:[]} as Student;}
  async deleteStudent(id:string){const {error}=await supabase.from('students').delete().eq('id',id);if(error)throw error;}
  async updateStudent(id:string,d:any){const a:any={...d};if(d.nextOfKin){a.next_of_kin=d.nextOfKin;delete a.nextOfKin;}const {data,error}=await supabase.from('students').update(a).eq('id',id).select().single();if(error)throw error;return{...data,nextOfKin:data.next_of_kin} as Student;}
  async getGlobalStats(){const [eRes,pRes]=await Promise.all([supabase.from('enrollments').select('id,status,enrollment_date,fee_balance'),supabase.from('payments').select('amount')]);if(eRes.error)throw eRes.error;if(pRes.error)throw pRes.error;const m=new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split('T')[0],n=(eRes.data||[]).map((e:any)=>({s:e.status,d:e.enrollment_date,o:Math.max(+e.fee_balance||0,0)})),totalRevenue=(pRes.data||[]).reduce((a:any,x:any)=>a+(+x.amount||0),0);return{totalActiveStudents:n.filter((x:any)=>x.s==='ACTIVE').length,totalGraduates:n.filter((x:any)=>x.s==='GRADUATED').length,totalDropouts:n.filter((x:any)=>x.s==='DROPOUT').length,totalRevenue,totalOutstanding:n.reduce((a:any,x:any)=>a+x.o,0),newEnrollmentsThisMonth:n.filter((x:any)=>x.d>=m).length};}
  async getRevenueData(){const {data,error}=await supabase.from('payments').select('amount,date');if(error)throw error;const w=months(M),m=new Map(w.map(x=>[x.key,0]));(data||[]).forEach((p:any)=>{const k=String(p.date||'').slice(0,7);if(m.has(k))m.set(k,(m.get(k)||0)+(+p.amount||0));});return w.map(x=>({name:x.label,revenue:m.get(x.key)||0}));}
  async getEnrollmentData(){const {data,error}=await supabase.from('enrollments').select('enrollment_date');if(error)throw error;const w=months(M),m=new Map(w.map(x=>[x.key,0]));(data||[]).forEach((e:any)=>{const k=String(e.enrollment_date||'').slice(0,7);if(m.has(k))m.set(k,(m.get(k)||0)+1);});return w.map(x=>({name:x.label,students:m.get(x.key)||0}));}
  async getRecentTransactions(limit=50){const {data,error}=await supabase.from('payments').select('id,enrollment_id,amount,date,method,reference,enrollments (id,course_name,program_type,level,total_fee,fee_balance,payment_status,students (name,email))').order('date',{ascending:false}).limit(limit);if(error)throw error;const tx=data||[];return tx.map((p:any)=>{const e=Array.isArray(p.enrollments)?p.enrollments[0]:p.enrollments,s=Array.isArray(e?.students)?e.students[0]:e?.students,st=(e?.payment_status||'PENDING') as 'PAID'|'PARTIAL'|'PENDING';return{id:p.id,enrollmentId:p.enrollment_id,student:s?.name||'Unknown Student',studentEmail:s?.email||'',courseName:e?.course_name||'Unknown Course',programName:e?.program_type||'',level:e?.level||'',amount:+p.amount||0,date:p.date,method:p.method,reference:p.reference||'',status:st,totalFee:+e?.total_fee||0,feeBalance:+e?.fee_balance||0};});}
  async addEnrollmentToStudent(studentId:string,e:any){
    const {data,error}=await supabase.from('enrollments').insert([{student_id:studentId,program_type:e.programType,course_id:e.courseId,course_name:e.courseName,level:e.level,teacher_id:e.teacherId,teacher_name:e.teacherName,status:e.status,fee_balance:e.feeBalance,total_fee:e.totalFee,enrollment_date:e.enrollmentDate,payment_status:e.paymentStatus}]).select().single();
    if(error)throw error;
    return{
      ...e,
      id:data.id,
      totalFee:+data.total_fee||+e.totalFee||0,
      feeBalance:+data.fee_balance||+e.feeBalance||0,
      paymentStatus:data.payment_status||e.paymentStatus||'PENDING',
      payments:[],
      feeItems:[],
      attendance:[]
    } as Enrollment;
  }
  async recordPayment(enrollmentId:string,p:any){
    const amount=Number(p?.amount||0);
    if(!enrollmentId)throw new Error('Enrollment ID is required.');
    if(!Number.isFinite(amount)||amount<=0)throw new Error('Payment amount must be greater than zero.');

    const method=String(p?.method||'').toUpperCase();
    if(!['MPESA','BANK','CASH'].includes(method))throw new Error('Payment method must be MPESA, BANK, or CASH.');

    const reference=String(p?.reference||'').trim();
    if(method!=='CASH'&&!reference)throw new Error('Reference is required for M-Pesa and bank transfer payments.');
    const date=String(p?.date||new Date().toISOString().split('T')[0]);
    const targetFeeItemId=String(p?.targetFeeItemId||'').trim();

    const {data:enrollment,error:enrollmentError}=await supabase.from('enrollments').select('fee_balance').eq('id',enrollmentId).single();
    if(enrollmentError||!enrollment)throw enrollmentError||new Error('Enrollment not found.');
    const outstandingBefore=Math.max(+enrollment.fee_balance||0,0);
    if(outstandingBefore<=0)throw new Error('This enrollment is already fully paid.');
    if(amount>outstandingBefore)throw new Error(`Payment exceeds outstanding balance (Ksh ${outstandingBefore.toLocaleString()}).`);

    let targetedFeeItem:any=null;
    if(targetFeeItemId){
      const {data,error}=await supabase
        .from('enrollment_fee_items')
        .select('id,label,balance')
        .eq('id',targetFeeItemId)
        .eq('enrollment_id',enrollmentId)
        .single();
      if(error||!data)throw new Error('Selected payment category is invalid for this enrollment.');
      targetedFeeItem=data;
      const targetBalance=Math.max(+data.balance||0,0);
      if(targetBalance<=0)throw new Error(`"${data.label}" is already fully paid.`);
      if(amount>targetBalance)throw new Error(`Amount exceeds selected category balance (Ksh ${targetBalance.toLocaleString()}).`);
    }

    let insertedPayment:any=null;
    try{
      const {data,error}=await supabase.from('payments').insert([{enrollment_id:enrollmentId,amount,date,reference,method}]).select().single();
      if(error)throw error;
      insertedPayment=data;

      if(targetedFeeItem){
        const {error:clearError}=await supabase.from('payment_allocations').delete().eq('payment_id',insertedPayment.id);
        if(clearError)throw clearError;
        const {error:allocationError}=await supabase.from('payment_allocations').insert([{
          payment_id:insertedPayment.id,
          enrollment_id:enrollmentId,
          enrollment_fee_item_id:targetedFeeItem.id,
          amount
        }]);
        if(allocationError)throw allocationError;
        const {error:recalcError}=await supabase.rpc('recalculate_enrollment_financials',{p_enrollment_id:enrollmentId});
        if(recalcError)throw recalcError;
      }

      return{id:insertedPayment.id,enrollmentId,amount,date,reference,method:method as 'MPESA' | 'BANK' | 'CASH'} as Payment;
    }catch(error){
      if(insertedPayment?.id){
        await supabase.from('payments').delete().eq('id',insertedPayment.id);
      }
      throw error;
    }
  }
  async reallocatePaymentToFeeItem(paymentId:string,enrollmentId:string,targetFeeItemId:string){
    const cleanPaymentId=String(paymentId||'').trim();
    const cleanEnrollmentId=String(enrollmentId||'').trim();
    const cleanTargetFeeItemId=String(targetFeeItemId||'').trim();
    if(!cleanPaymentId)throw new Error('Payment ID is required.');
    if(!cleanEnrollmentId)throw new Error('Enrollment ID is required.');
    if(!cleanTargetFeeItemId)throw new Error('Target fee item is required.');

    const {data:payment,error:paymentError}=await supabase
      .from('payments')
      .select('id,enrollment_id,amount')
      .eq('id',cleanPaymentId)
      .single();
    if(paymentError||!payment)throw paymentError||new Error('Payment not found.');
    if(payment.enrollment_id!==cleanEnrollmentId)throw new Error('Payment does not belong to the selected enrollment.');
    const paymentAmount=Math.max(Number(payment.amount||0),0);
    if(paymentAmount<=0)throw new Error('Payment amount must be greater than zero.');

    const [targetRes,otherAllocationsRes]=await Promise.all([
      supabase
        .from('enrollment_fee_items')
        .select('id,enrollment_id,label,amount')
        .eq('id',cleanTargetFeeItemId)
        .single(),
      supabase
        .from('payment_allocations')
        .select('amount')
        .eq('enrollment_fee_item_id',cleanTargetFeeItemId)
        .neq('payment_id',cleanPaymentId)
    ]);
    if(targetRes.error||!targetRes.data)throw targetRes.error||new Error('Target fee item not found.');
    if(targetRes.data.enrollment_id!==cleanEnrollmentId)throw new Error('Selected fee item does not belong to this enrollment.');
    if(otherAllocationsRes.error)throw otherAllocationsRes.error;

    const paidToTargetFromOtherPayments=(otherAllocationsRes.data||[])
      .reduce((sum:number,a:any)=>sum+(+a.amount||0),0);
    const targetAmount=Math.max(Number(targetRes.data.amount||0),0);
    const maxAssignable=Math.max(targetAmount-paidToTargetFromOtherPayments,0);

    if(paymentAmount>maxAssignable){
      throw new Error(`Payment amount exceeds "${targetRes.data.label}" remaining capacity (Ksh ${Math.max(maxAssignable,0).toLocaleString()}).`);
    }

    const {error:clearError}=await supabase.from('payment_allocations').delete().eq('payment_id',cleanPaymentId);
    if(clearError)throw clearError;
    const {error:insertError}=await supabase.from('payment_allocations').insert([{
      payment_id:cleanPaymentId,
      enrollment_id:cleanEnrollmentId,
      enrollment_fee_item_id:cleanTargetFeeItemId,
      amount:paymentAmount
    }]);
    if(insertError)throw insertError;
    const {error:recalcError}=await supabase.rpc('recalculate_enrollment_financials',{p_enrollment_id:cleanEnrollmentId});
    if(recalcError)throw recalcError;
    return true;
  }
  async addEnrollmentFeeItem(enrollmentId:string,item:{label:string;amount:number;category?:string;code?:string;sortOrder?:number;meta?:Record<string,any>}){
    if(!enrollmentId)throw new Error('Enrollment ID is required.');
    const label=String(item?.label||'').trim();
    const amount=Number(item?.amount||0);
    if(!label)throw new Error('Charge item label is required.');
    if(!Number.isFinite(amount)||amount<=0)throw new Error('Charge amount must be greater than zero.');
    const category=String(item?.category||'OTHER').toUpperCase();
    const sortOrder=Number.isFinite(Number(item?.sortOrder))?Math.max(Number(item.sortOrder),1):100;
    const payload:any={
      enrollment_id:enrollmentId,
      category,
      code:item?.code?String(item.code).trim():null,
      label,
      amount:Math.max(amount,0),
      sort_order:sortOrder,
      meta:item?.meta||{}
    };
    const {data,error}=await supabase.from('enrollment_fee_items').insert([payload]).select().single();
    if(error)throw error;
    return{
      id:data.id,
      enrollmentId:data.enrollment_id,
      category:data.category,
      code:data.code||undefined,
      label:data.label,
      amount:+data.amount||0,
      sortOrder:+data.sort_order||sortOrder,
      amountPaid:+data.amount_paid||0,
      balance:+data.balance||(+data.amount||0),
      status:data.status||'PENDING',
      meta:data.meta||{}
    };
  }
  async markTeacherAttendance(i:any){const {data,error}=await supabase.from('teacher_attendance').upsert([{teacher_id:i.teacherId,course_id:i.courseId,level:i.level,date:i.date,status:i.status,notes:i.notes||''}],{onConflict:'teacher_id,course_id,level,date'}).select().single();if(error)throw error;return{id:data.id,teacherId:data.teacher_id,courseId:data.course_id,level:data.level,date:data.date,status:data.status,notes:data.notes||''} as TeacherAttendance;}
  async addGrade(g:any){const {data,error}=await supabase.from('grades').insert([{enrollment_id:g.enrollmentId,teacher_id:g.teacherId,assessment_name:g.assessmentName,assessment_type:g.assessmentType,score:g.score,max_score:g.maxScore,weight:g.weight,graded_at:g.gradedAt,remarks:g.remarks||''}]).select().single();if(error)throw error;return{id:data.id,enrollmentId:data.enrollment_id,teacherId:data.teacher_id,assessmentName:data.assessment_name,assessmentType:data.assessment_type,score:+data.score,maxScore:+data.max_score,weight:+data.weight,gradedAt:data.graded_at,remarks:data.remarks||''} as GradeRecord;}
  async updateGrade(gradeId:string, teacherId:string, g:any){const payload:any={};if(g.assessmentName!==undefined)payload.assessment_name=g.assessmentName;if(g.assessmentType!==undefined)payload.assessment_type=g.assessmentType;if(g.score!==undefined)payload.score=g.score;if(g.maxScore!==undefined)payload.max_score=g.maxScore;if(g.weight!==undefined)payload.weight=g.weight;if(g.remarks!==undefined)payload.remarks=g.remarks||'';const q=supabase.from('grades').update(payload).eq('id',gradeId).eq('teacher_id',teacherId).select().single();const {data,error}=await q;if(error)throw error;return{id:data.id,enrollmentId:data.enrollment_id,teacherId:data.teacher_id,assessmentName:data.assessment_name,assessmentType:data.assessment_type,score:+data.score,maxScore:+data.max_score,weight:+data.weight,gradedAt:data.graded_at,remarks:data.remarks||''} as GradeRecord;}
  async addStudentInsight(i:any){const {data,error}=await supabase.from('student_insights').insert([{enrollment_id:i.enrollmentId,teacher_id:i.teacherId,insight:i.insight}]).select().single();if(error)throw error;return{id:data.id,enrollmentId:data.enrollment_id,teacherId:data.teacher_id,insight:data.insight,createdAt:data.created_at} as StudentInsight;}
  async uploadCertificate(enrollmentId:string,teacherId:string,file:File){const path=`${enrollmentId}/${Date.now()}-${file.name}`;const up=await supabase.storage.from('certificates').upload(path,file,{upsert:true});if(up.error)throw up.error;const {data:u}=supabase.storage.from('certificates').getPublicUrl(path);const {data,error}=await supabase.from('certificates').insert([{enrollment_id:enrollmentId,teacher_id:teacherId,file_name:file.name,file_url:u.publicUrl}]).select().single();if(error)throw error;return{id:data.id,enrollmentId:data.enrollment_id,teacherId:data.teacher_id,fileName:data.file_name,fileUrl:data.file_url,uploadedAt:data.uploaded_at} as Certificate;}
  async getEnrollmentAcademicBundle(ids:string[]){const out=ids.reduce((a:any,id)=>{a[id]={grades:[],insights:[],certificates:[],overallGrade:0};return a;},{} as Record<string,any>);if(!ids.length)return out;const [g,i,c]=await Promise.all([supabase.from('grades').select('*').in('enrollment_id',ids).order('graded_at',{ascending:false}),supabase.from('student_insights').select('*').in('enrollment_id',ids).order('created_at',{ascending:false}),supabase.from('certificates').select('*').in('enrollment_id',ids).order('uploaded_at',{ascending:false})]);(g.data||[]).forEach((r:any)=>{if(!out[r.enrollment_id])return;out[r.enrollment_id].grades.push({id:r.id,enrollmentId:r.enrollment_id,teacherId:r.teacher_id,assessmentName:r.assessment_name,assessmentType:r.assessment_type,score:+r.score,maxScore:+r.max_score,weight:+r.weight,gradedAt:r.graded_at,remarks:r.remarks||''});});(i.data||[]).forEach((r:any)=>{if(!out[r.enrollment_id])return;out[r.enrollment_id].insights.push({id:r.id,enrollmentId:r.enrollment_id,teacherId:r.teacher_id,insight:r.insight,createdAt:r.created_at});});(c.data||[]).forEach((r:any)=>{if(!out[r.enrollment_id])return;out[r.enrollment_id].certificates.push({id:r.id,enrollmentId:r.enrollment_id,teacherId:r.teacher_id,fileName:r.file_name,fileUrl:r.file_url,uploadedAt:r.uploaded_at});});Object.keys(out).forEach(id=>out[id].overallGrade=overall(out[id].grades.map((x:any)=>({score:x.score,maxScore:x.maxScore,weight:x.weight}))));return out;}
  async createNotification(n:any){const {data,error}=await supabase.from('notifications').insert([{title:n.title,message:n.message,target_role:n.targetRole,created_by:n.createdBy||null,active:true}]).select().single();if(error)throw error;return{id:data.id,title:data.title,message:data.message,targetRole:data.target_role,createdBy:data.created_by,createdAt:data.created_at,active:data.active} as AppNotification;}
  async getNotifications(role:'ADMIN'|'TEACHER'){const {data,error}=await supabase.from('notifications').select('*').eq('active',true).or(`target_role.eq.${role},target_role.eq.ALL`).order('created_at',{ascending:false}).limit(50);if(error)throw error;return (data||[]).map((r:any)=>({id:r.id,title:r.title,message:r.message,targetRole:r.target_role,createdBy:r.created_by,createdAt:r.created_at,active:r.active})) as AppNotification[];}
  async getAdminSentNotifications(adminId:string){const {data,error}=await supabase.from('notifications').select('*').eq('created_by',adminId).in('target_role',['TEACHER','ALL']).order('created_at',{ascending:false}).limit(100);if(error)throw error;return (data||[]).map((r:any)=>({id:r.id,title:r.title,message:r.message,targetRole:r.target_role,createdBy:r.created_by,createdAt:r.created_at,active:r.active})) as AppNotification[];}
  async updateNotification(id:string,u:any){const p:any={};if(u.title!==undefined)p.title=u.title;if(u.message!==undefined)p.message=u.message;if(u.targetRole!==undefined)p.target_role=u.targetRole;if(u.active!==undefined)p.active=u.active;const {data,error}=await supabase.from('notifications').update(p).eq('id',id).select().single();if(error)throw error;return{id:data.id,title:data.title,message:data.message,targetRole:data.target_role,createdBy:data.created_by,createdAt:data.created_at,active:data.active} as AppNotification;}
  async deleteNotification(id:string){const {error}=await supabase.from('notifications').delete().eq('id',id);if(error)throw error;}
  async adminUpsertTeacherAuth(input:{teacherId:string;email:string;name:string;password:string}){return await this.invokeAdminTeacherAuth({action:'upsert_teacher_auth',...input});}
  async adminResetTeacherPassword(input:{teacherId:string;newPassword:string}){return await this.invokeAdminTeacherAuth({action:'reset_teacher_password',...input});}
  async markAttendance(enrollmentId:string,a:any){const {data,error}=await supabase.from('attendance').upsert([{enrollment_id:enrollmentId,date:a.date,status:a.status}],{onConflict:'enrollment_id,date'}).select().single();if(error)throw error;return {...a,id:data.id} as Attendance;}
}
export const dataService=new DataService();
