function padTime(time, pad = true) {
  return pad ? `00${time}`.slice(-2) : time;
}

function formatTime(time) {
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor(time / 60 % 60);
  const seconds = time % 60;

  return `${hours ? `${hours}:` : ""}${padTime(minutes, hours)}:${padTime(seconds)}`;
}

function getMonth(month, useShortName = false) {
  const months = {
    0: "January",
    1: "February",
    2: "March",
    3: "April",
    4: "May",
    5: "June",
    6: "July",
    7: "August",
    8: "September",
    9: "October",
    10: "November",
    11: "December"
  };

  return useShortName ? months[month].slice(0, 3) : months[month];
}

export {
  formatTime,
  getMonth
};
