function reservar(espacio){
  const fecha = document.getElementById("fecha").value;
  const hora_inicio = document.getElementById("hora").value;
  if(!fecha){ alert("Debes seleccionar una fecha"); return; }

  let nombreEspacio;
  if(espacio <= 9) nombreEspacio = `Puesto ${espacio}`;
  else if(espacio === 11) nombreEspacio = "Mesa - M1";
  else if(espacio === 12) nombreEspacio = "Mesa - M2";
  else if(espacio === 13) nombreEspacio = "Mesa - M3";
  else if(espacio === 14) nombreEspacio = "Mesa - M4";
  else if(espacio === 15) nombreEspacio = "Mesa - M5";
  else if(espacio === 16) nombreEspacio = "Mesa - M6";

  if(!confirm(`¿Reservar ${nombreEspacio} el ${fecha} a las ${hora_inicio}?`)) return;

  fetch("/reservar",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ espacio, fecha, hora_inicio })
  })
  .then(res=>res.json())
  .then(data=>{
    alert(data.mensaje);
    actualizarMapa();
  });
}

function verReservas(){
  const fecha = document.getElementById("fecha").value;
  if(!fecha) return;
  fetch("/reservas/"+fecha)
    .then(res=>res.json())
    .then(data=>{
      let html="";
      if(data.length === 0){
        html = "<p>No hay reservas este día.</p>";
      } else {
        data.forEach(r=>{
          let nombre;
          if(r.espacio <= 9) nombre = `Puesto ${r.espacio}`;
          else if(r.espacio === 11) nombre = "Mesa - M1";
          else if(r.espacio === 12) nombre = "Mesa - M2";
          else if(r.espacio === 13) nombre = "Mesa - M3";
          else if(r.espacio === 14) nombre = "Mesa - M4";
          else if(r.espacio === 15) nombre = "Mesa - M5";
          else if(r.espacio === 16) nombre = "Mesa - M6";
          html += `
          <div class="reserva">
            <strong>${nombre}</strong> | ${r.usuario} | CC: ${r.documento}
            <br>⏰ ${r.hora_inicio} - ${r.hora_fin}
            <br><button class="cancelar" onclick="cancelar(${r.id})">Cancelar</button>
          </div>`;
        });
      }
      document.getElementById("listaReservas").innerHTML = html;
    });
}

function cancelar(id){
  if(!confirm("¿Seguro que deseas cancelar esta reserva?")) return;
  fetch("/cancelar",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({id})
  })
  .then(res=>res.json())
  .then(data=>{ alert(data.mensaje); actualizarMapa(); });
}

function verReservas(){
  const fecha = document.getElementById("fecha").value;

  if(!fecha) return;

  fetch("/reservas/"+fecha)
    .then(res=>res.json())
    .then(data=>{
      let html="";

      if(data.length === 0){
        html = "<p>No hay reservas este día. Todos los espacios están disponibles.</p>";
      }else{
        data.forEach(r=>{
          const nombreEspacio = r.espacio <= 9 ? `Puesto ${r.espacio}` : "Mesa 1";
          html += `
          <div class="reserva">
            <strong>${nombreEspacio}</strong> | ${r.usuario} | CC: ${r.documento}
            <br>⏰ ${r.hora_inicio} - ${r.hora_fin}
            <br><button class="cancelar" onclick="cancelar(${r.id})">Cancelar</button>
          </div>`;
        });
      }

      document.getElementById("listaReservas").innerHTML = html;
    });
}

function cancelar(id){
  if(!confirm("¿Seguro que deseas cancelar esta reserva?")) return;

  fetch("/cancelar",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({id:id})
  })
  .then(res=>res.json())
  .then(data=>{
    alert(data.mensaje);
    actualizarMapa();
  });
}